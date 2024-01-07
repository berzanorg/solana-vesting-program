use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer},
};

declare_id!("J1q6xFrv2pj5Q1YFjwK2J4nwvZE5pJFtkmvE5jmcy3bJ");

#[program]
pub mod solana_vesting_program {
    use anchor_spl::token;

    use super::*;

    pub fn lock(
        ctx: Context<Lock>,
        reciever: Pubkey,
        amount: u64,
        start_date: u64,
        end_date: u64,
    ) -> Result<()> {
        let locking = &mut ctx.accounts.locking;
        let mint = &ctx.accounts.mint;
        let signer = &ctx.accounts.signer;
        let vault_ata = &ctx.accounts.vault_ata;
        let signer_ata = &ctx.accounts.signer_ata;
        let token_program = &ctx.accounts.token_program;

        require!(end_date > start_date, CustomError::EndBeforeStart);

        let transfer = Transfer {
            from: signer_ata.to_account_info(),
            to: vault_ata.to_account_info(),
            authority: signer.to_account_info(),
        };
        let token_transfer_context = CpiContext::new(token_program.to_account_info(), transfer);
        token::transfer(token_transfer_context, amount)?;

        locking.mint = mint.key();
        locking.reciever = reciever;
        locking.amount = amount;
        locking.amount_unlocked = 0;
        locking.start_date = start_date;
        locking.end_date = end_date;

        Ok(())
    }

    pub fn unlock(ctx: Context<Unlock>) -> Result<()> {
        let locking = &mut ctx.accounts.locking;
        let vault = &ctx.accounts.vault;
        let vault_ata = &ctx.accounts.vault_ata;
        let reciever_ata = &ctx.accounts.reciever_ata;
        let token_program = &ctx.accounts.token_program;

        let now: u64 = Clock::get().unwrap().unix_timestamp.try_into().unwrap();

        require!(now > locking.start_date, CustomError::CliffPeriodNotPassed);

        let passed_seconds = now - locking.start_date;
        let total_seconds = locking.end_date - locking.start_date;

        let entitled_amount = if now >= locking.end_date {
            locking.amount - locking.amount_unlocked
        } else {
            locking.amount * passed_seconds / total_seconds - locking.amount_unlocked
        };

        let seeds = [b"vault".as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];
        let transfer = Transfer {
            from: vault_ata.to_account_info(),
            to: reciever_ata.to_account_info(),
            authority: vault.to_account_info(),
        };
        let token_transfer_context =
            CpiContext::new_with_signer(token_program.to_account_info(), transfer, signer);
        token::transfer(token_transfer_context, entitled_amount)?;

        locking.amount_unlocked += entitled_amount;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(
    reciever: Pubkey,
)]
pub struct Lock<'info> {
    #[account(
        init_if_needed,
        seeds=[b"vault"],
        bump,
        payer = signer,
        space = Vault::INIT_SPACE + 8,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        associated_token::mint = mint,
        associated_token::authority = vault,
        payer = signer,
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        seeds=[b"locking", reciever.key().as_ref(), mint.key().as_ref()],
        bump,
        payer = signer,
        space = Locking::INIT_SPACE + 8,
    )]
    pub locking: Account<'info, Locking>,

    #[account(
        mut,
        constraint = signer_ata.owner.key() == signer.key(),
        constraint = signer_ata.mint.key() == mint.key(),
    )]
    pub signer_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unlock<'info> {
    #[account(
        mut,
        seeds=[b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        constraint = vault_ata.owner == vault.key(),
        constraint = vault_ata.mint == mint.key(),
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        associated_token::mint = mint,
        associated_token::authority = reciever,
        payer = signer,
    )]
    pub reciever_ata: Account<'info, TokenAccount>,

    /// CHECK: Just a public key of a Solana account.
    pub reciever: AccountInfo<'info>,

    #[account(
        mut,
        seeds=[b"locking", reciever.key().as_ref(), mint.key().as_ref()],
        bump,
        constraint = locking.reciever.key() == reciever.key(),
        constraint = locking.mint.key() == mint.key(),
        constraint = locking.amount_unlocked < locking.amount,
    )]
    pub locking: Account<'info, Locking>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(InitSpace)]
#[account]
pub struct Vault {}

#[derive(InitSpace)]
#[account]
pub struct Locking {
    mint: Pubkey,         // mint address of tokens locked
    reciever: Pubkey,     // reciever of locked tokens
    amount: u64,          // amount of tokens locked
    amount_unlocked: u64, // amount of tokens already unlocked
    start_date: u64,      // starting date as unix timestamp in seconds
    end_date: u64,        // ending date as unix timestamp in seconds
}

#[error_code]
pub enum CustomError {
    EndBeforeStart,
    CliffPeriodNotPassed,
}
