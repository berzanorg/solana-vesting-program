use anchor_lang::prelude::*;

declare_id!("J1q6xFrv2pj5Q1YFjwK2J4nwvZE5pJFtkmvE5jmcy3bJ");

#[program]
pub mod solana_vesting_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
