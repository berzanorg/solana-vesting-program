import { workspace, setProvider, AnchorProvider, BN } from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { SolanaVestingProgram } from "../target/types/solana_vesting_program"
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import {
    createMint,
    TOKEN_PROGRAM_ID,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddress,
} from "@solana/spl-token"
import { assert, expect } from "chai"

describe("solana-vesting-program", () => {
    const provider = AnchorProvider.env()
    const connection = provider.connection

    setProvider(provider)

    const program =
        workspace.SolanaVestingProgram as Program<SolanaVestingProgram>

    const satoshi = Keypair.generate()
    const vitalik = Keypair.generate()


    const alice = Keypair.generate()
    const alicia = Keypair.generate()
    const bob = Keypair.generate()
    const marley = Keypair.generate()

    const sleep = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

    const getVault = () => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("vault")],
            program.programId
        )[0]
    }

    const getLocking = (reciever: PublicKey, mint: PublicKey) => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("locking"), reciever.toBuffer(), mint.toBuffer()],
            program.programId
        )[0]
    }


    const mintBtc = async (reciever: PublicKey, amount: number, isPda?: true) => {
        const { address } = await getOrCreateAssociatedTokenAccount(connection, satoshi, btcMint, reciever, isPda)
        await mintTo(connection, satoshi, btcMint, address, satoshi, amount)
    }

    const mintEth = async (reciever: PublicKey, amount: number, isPda?: true) => {
        const { address } = await getOrCreateAssociatedTokenAccount(connection, vitalik, ethMint, reciever, isPda)
        await mintTo(connection, vitalik, ethMint, address, vitalik, amount)
    }


    const getBtcAddress = async (reciever: PublicKey, allowOwnerOffCurve?: boolean) => {
        const address = await getAssociatedTokenAddress(btcMint, reciever, allowOwnerOffCurve)
        return address
    }

    const getEthAddress = async (reciever: PublicKey, allowOwnerOffCurve?: boolean) => {
        const address = await getAssociatedTokenAddress(ethMint, reciever, allowOwnerOffCurve)
        return address
    }

    const getAirdrop = async (reciever: PublicKey) => {
        const signature = await connection.requestAirdrop(
            reciever,
            3 * LAMPORTS_PER_SOL
        )

        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash()

        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature,
        })
    }


    const vault = getVault()

    let btcMint: PublicKey
    let ethMint: PublicKey

    before(async () => {
        await Promise.all([
            getAirdrop(satoshi.publicKey),
            getAirdrop(vitalik.publicKey),
            getAirdrop(alice.publicKey),
            getAirdrop(alicia.publicKey),
            getAirdrop(bob.publicKey),
            getAirdrop(marley.publicKey),
        ])
    })

    before(async () => {
        btcMint = await createMint(
            connection,
            satoshi,
            satoshi.publicKey,
            null,
            9,
            undefined,
            {},
            TOKEN_PROGRAM_ID
        )

        ethMint = await createMint(
            connection,
            vitalik,
            vitalik.publicKey,
            null,
            9,
            undefined,
            {},
            TOKEN_PROGRAM_ID
        )
    })


    before(async () => {
        await Promise.all([
            mintBtc(bob.publicKey, 21_000_000_000_000),
            mintBtc(alicia.publicKey, 0),
            mintEth(alice.publicKey, 100_000_000_000_000),
        ])
    })



    it("Can't lock tokens when ending date is before starting date!", async () => {
        const amount = new BN(1_000_000_000_000)
        const startDate = new BN(Math.floor(Date.now() / 1000) + 10) // 10 sec after now
        const endDate = new BN(Math.floor(Date.now() / 1000) + 1) // 1 sec after now

        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        try {
            await program.methods
                .lock(marley.publicKey, amount, startDate, endDate)
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    signerAta: bobAta,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'Ending date is before start date.')
        }
    })


    it("Can't lock tokens when ending vault PDA ATA is mistaken!", async () => {
        const amount = new BN(1_000_000_000_000)
        const startDate = new BN(Math.floor(Date.now() / 1000) + 1) // 1 sec after now
        const endDate = new BN(Math.floor(Date.now() / 1000) + 3) // 3 secs after now

        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVault = Keypair.generate().publicKey
        const fakeVaultAta = await getAssociatedTokenAddress(btcMint, fakeVault, false)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        try {
            await program.methods
                .lock(marley.publicKey, amount, startDate, endDate)
                .accounts({
                    vault,
                    locking,
                    vaultAta: fakeVaultAta,
                    signerAta: bobAta,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch { }
    })

    it("Can't lock tokens when both vault PDA & vault PDA ATA!", async () => {
        const amount = new BN(1_000_000_000_000)
        const startDate = new BN(Math.floor(Date.now() / 1000) + 1) // 1 sec after now
        const endDate = new BN(Math.floor(Date.now() / 1000) + 3) // 3 secs after now

        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVault = Keypair.generate().publicKey
        const fakeVaultAta = await getAssociatedTokenAddress(btcMint, fakeVault, false)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        try {
            await program.methods
                .lock(marley.publicKey, amount, startDate, endDate)
                .accounts({
                    vault: fakeVault,
                    locking,
                    vaultAta: fakeVaultAta,
                    signerAta: bobAta,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'A seeds constraint was violated')
        }
    })



    it("Can lock tokens!", async () => {
        const amount = new BN(1_000_000_000_000)
        const startDate = new BN(Math.floor(Date.now() / 1000) + 1) // 1 sec after now
        const endDate = new BN(Math.floor(Date.now() / 1000) + 3) // 3 secs after now

        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        await program.methods
            .lock(marley.publicKey, amount, startDate, endDate)
            .accounts({
                vault,
                locking,
                vaultAta,
                signerAta: bobAta,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()

        const account = await program.account.locking.fetch(locking)

        assert(account.amount.eq(amount))
        assert(account.amountUnlocked.eq(new BN(0)))
        assert(account.startDate.eq(startDate))
        assert(account.endDate.eq(endDate))
        assert(account.mint.equals(btcMint))
        assert(account.reciever.equals(marley.publicKey))

        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobAta)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultAta)).value.amount

        assert(bobRemainingBalance === String(20_000_000_000_000))
        assert(vaultNewBalance === String(1_000_000_000_000))
    })

    it("Can't unlock tokens when cliff period is not passed!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)
        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'Cliff period is not passed.')
        }
    })

    it("Can't unlock tokens when vault PDA is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVault = Keypair.generate().publicKey
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        await sleep(3000)

        try {
            await program.methods
                .unlock()
                .accounts({
                    vault: fakeVault,
                    locking,
                    vaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()
            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'The program expected this account to be already initialized')
        }
    })


    it("Can't unlock tokens when vault PDA ATA is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVaultAta = Keypair.generate().publicKey
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta: fakeVaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()
            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'The program expected this account to be already initialized')
        }
    })

    it("Can't unlock tokens when both vault PDA & vault PDA ATA is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVault = Keypair.generate().publicKey
        const fakeVaultAta = await getAssociatedTokenAddress(btcMint, fakeVault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        try {
            await program.methods
                .unlock()
                .accounts({
                    vault: fakeVault,
                    locking,
                    vaultAta: fakeVaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()
            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'The program expected this account to be already initialized')
        }
    })

    it("Can't unlock tokens when vault PDA & vault PDA ATA don't match!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const fakeVault = Keypair.generate().publicKey
        const fakeVaultAta = await getAssociatedTokenAddress(btcMint, fakeVault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta: fakeVaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()
            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'The program expected this account to be already initialized')
        }
    })


    it("Can't unlock tokens when reciever is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)
        const fakeReciever = alicia.publicKey
        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: marleyAta,
                    reciever: fakeReciever,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch { }
    })

    it("Can't unlock tokens when reciever ATA is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const fakeRecieverAta = await getAssociatedTokenAddress(btcMint, alicia.publicKey, false)
        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: fakeRecieverAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'A token owner constraint was violated')
        }
    })


    it("Can't unlock tokens when both reciever & reciever ATA is mistaken!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const fakeReciever = alicia.publicKey
        const fakeRecieverAta = await getAssociatedTokenAddress(btcMint, fakeReciever, false)
        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: fakeRecieverAta,
                    reciever: fakeReciever,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'A seeds constraint was violated')
        }
    })


    it("Can't unlock tokens when reciever & reciever ATA don't match!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const fakeRecieverAta = await getAssociatedTokenAddress(btcMint, alicia.publicKey, false)
        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: fakeRecieverAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'A token owner constraint was violated')
        }
    })


    it("Can't unlock tokens when locking PDA is mistaken!", async () => {
        const amount = new BN(0)
        const startDate = new BN(Math.floor(Date.now() / 1000) + 1) // 1 sec after now
        const endDate = new BN(Math.floor(Date.now() / 1000) + 3) // 3 secs after now

        const locking = getLocking(alicia.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        await program.methods
            .lock(alicia.publicKey, amount, startDate, endDate)
            .accounts({
                vault,
                locking,
                vaultAta,
                signerAta: bobAta,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()


        try {
            await program.methods
                .unlock()
                .accounts({
                    vault,
                    locking,
                    vaultAta,
                    recieverAta: marleyAta,
                    reciever: marley.publicKey,
                    signer: bob.publicKey,
                    mint: btcMint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([bob])
                .rpc()

            throw Error('Should have thrown!')
        } catch (error) {
            assert.equal(error.error.errorMessage, 'A seeds constraint was violated')
        }
    })






    it("Can unlock tokens after cliff duration is passed!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)

        await program.methods
            .unlock()
            .accounts({
                vault,
                locking,
                vaultAta,
                recieverAta: marleyAta,
                reciever: marley.publicKey,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()
    })

    it("Can unlock tokens after ending data is passed!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        await sleep(3000)

        await mintBtc(vault, 10_000_000_000_000, true)

        await program.methods
            .unlock()
            .accounts({
                vault,
                locking,
                vaultAta,
                recieverAta: marleyAta,
                reciever: marley.publicKey,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()

        const account = await program.account.locking.fetch(locking)


        assert(account.amountUnlocked.eq(new BN(1_000_000_000_000)))

        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobAta)).value.amount
        const marleyNewBalance = (await connection.getTokenAccountBalance(marleyAta)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultAta)).value.amount


        assert(bobRemainingBalance === String(20_000_000_000_000))
        assert(marleyNewBalance === String(1_000_000_000_000))
        assert(vaultNewBalance === String(10_000_000_000_000))
    })


    it("Can unlock tokens after all the tokens are unlocked!", async () => {
        const locking = getLocking(marley.publicKey, btcMint)
        const vaultAta = await getAssociatedTokenAddress(btcMint, vault, true)
        const marleyAta = await getAssociatedTokenAddress(btcMint, marley.publicKey, false)
        const bobAta = await getAssociatedTokenAddress(btcMint, bob.publicKey, false)

        await program.methods
            .unlock()
            .accounts({
                vault,
                locking,
                vaultAta,
                recieverAta: marleyAta,
                reciever: marley.publicKey,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()

        const account = await program.account.locking.fetch(locking)


        assert(account.amountUnlocked.eq(new BN(1_000_000_000_000)))

        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobAta)).value.amount
        const marleyNewBalance = (await connection.getTokenAccountBalance(marleyAta)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultAta)).value.amount


        assert(bobRemainingBalance === String(20_000_000_000_000))
        assert(marleyNewBalance === String(1_000_000_000_000))
        assert(vaultNewBalance === String(10_000_000_000_000))
    })
})