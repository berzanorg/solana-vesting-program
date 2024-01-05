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

    pub fn lock(ctx: Context<Lock>, token_amount: u64, deadline: i64) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        let timed_lock = &mut ctx.accounts.timed_lock;
        let signer_pubkey = ctx.accounts.signer.key();
        let mint = ctx.accounts.mint.key();

        if locker.address == Pubkey::default() && locker.counter == 0 {
            locker.address = signer_pubkey;
        } else {
            require!(locker.address == signer_pubkey, CustomError::DeadlineIsNotOver);
        }

        require!(ctx.accounts.token_account_of_vault.owner == ctx.accounts.vault.key(), CustomError::DeadlineIsNotOver);

        require!(ctx.accounts.token_account_of_vault.mint == ctx.accounts.mint.key(), CustomError::DeadlineIsNotOver);
        
        
        let cpi_program = ctx.accounts.token_program.to_account_info();

        let transfer = Transfer {
            from: ctx.accounts.token_account_of_signer.to_account_info(),
            to: ctx.accounts.token_account_of_vault.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };

        let token_transfer_context = CpiContext::new(cpi_program, transfer);

        token::transfer(token_transfer_context, token_amount)?;

    
        
        timed_lock.id = locker.counter;
        timed_lock.locker = signer_pubkey;
        timed_lock.mint = mint;
        timed_lock.deadline = deadline;
        timed_lock.token_amount = token_amount;

        locker.counter += 1;

        Ok(())
    }

    pub fn unlock(ctx: Context<Unlock>, _lock_id: u8) -> Result<()> {
        
        let cpi_program = ctx.accounts.token_program.to_account_info();

        let timed_lock = &mut ctx.accounts.timed_lock;

        require!(
            timed_lock.deadline < Clock::get().unwrap().unix_timestamp,
            CustomError::DeadlineIsNotOver
        );

        let seeds = &[b"vault".as_ref(), &[ctx.bumps.vault]];

        let signer = &[&seeds[..]];


        let transfer = Transfer {
            from: ctx.accounts.token_account_of_vault.to_account_info(),
            to: ctx.accounts.token_account_of_signer.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        

        let token_transfer_context = CpiContext::new_with_signer(cpi_program, transfer, signer);

        

        token::transfer(token_transfer_context, timed_lock.token_amount)?;



        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(
    token_amount: u64,
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
        seeds=[b"locker", signer.key().as_ref()],
        bump,
        payer = signer, 
        space = Locker::INIT_SPACE + 8,
        // constraint = locker.address == signer.key()
    )]
    pub locker: Account<'info, Locker>,

    #[account(
        init,
        seeds=[b"timed_lock", signer.key().as_ref(), mint.key().as_ref(), &[locker.counter]],
        bump,
        payer = signer, 
        space = TimedLock::INIT_SPACE + 8,
    )]
    pub timed_lock: Account<'info, TimedLock>,

    #[account(
        init_if_needed,
        associated_token::mint = mint, 
        associated_token::authority = vault,
        // constraint = token_account_of_vault.owner.key() == vault.key(),
        // constraint = token_account_of_vault.mint == mint.key(),
        payer = signer, 
    )]
    pub token_account_of_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_account_of_signer.owner.key() == signer.key(),
        constraint = token_account_of_signer.amount >= token_amount, 
        constraint = token_account_of_signer.mint == mint.key(),
    )]
    pub token_account_of_signer: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    _lock_id: u8
)]
pub struct Unlock<'info> {
    #[account(
        mut,
        seeds=[b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds=[b"locker", signer.key().as_ref()],
        bump,
        constraint = locker.address.key() == signer.key(),
    )]
    pub locker: Account<'info, Locker>,

    #[account(
        mut,
        seeds=[b"timed_lock", signer.key().as_ref(), mint.key().as_ref(), &[_lock_id]],
        bump,
        constraint = timed_lock.id == _lock_id,
        constraint = timed_lock.locker.key() == signer.key(),
        constraint = timed_lock.mint == mint.key(),
        close = signer,
    )]
    pub timed_lock: Account<'info, TimedLock>,

    #[account(
        mut,
        constraint = token_account_of_vault.owner.key() == vault.key(),
        constraint = token_account_of_vault.mint == mint.key(),
    )]
    pub token_account_of_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        associated_token::mint = mint, 
        associated_token::authority = signer,
        constraint = token_account_of_signer.owner.key() == signer.key(),
        constraint = token_account_of_signer.mint == mint.key(),
        payer = signer, 
    )]
    pub token_account_of_signer: Account<'info, TokenAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum CustomError {
    #[msg("Deadline is not over.")]
    DeadlineIsNotOver,
}

#[derive(InitSpace)]
#[account]
pub struct Vault {}

#[derive(InitSpace)]
#[account]
pub struct TimedLock {
    id: u8,
    locker: Pubkey,
    mint: Pubkey,
    deadline: i64,
    token_amount: u64,
}

#[derive(InitSpace)]
#[account]
pub struct Locker {
    address: Pubkey,
    counter: u8,
}