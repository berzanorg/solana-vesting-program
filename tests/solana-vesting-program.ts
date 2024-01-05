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
    // Configure the client to use the local cluster.
    const provider = AnchorProvider.env()
    const connection = provider.connection

    setProvider(provider)

    const program =
        workspace.SolanaVestingProgram as Program<SolanaVestingProgram>

    const bob = Keypair.generate()
    const alice = Keypair.generate()


    const getVault = () => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("vault")],
            program.programId
        )[0]
    }

    const getLocker = (signer: PublicKey) => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("locker"), signer.toBuffer()],
            program.programId
        )[0]
    }

    const getTimedLock = (
        signer: PublicKey,
        mint: PublicKey,
        lock_id: number
    ) => {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("timed_lock"),
                signer.toBuffer(),
                mint.toBuffer(),
                new BN(lock_id).toBuffer(),
            ],
            program.programId
        )[0]
    }

    const vault = getVault()
    const bobLocker = getLocker(bob.publicKey)
    const aliceLocker = getLocker(alice.publicKey)


    let vaultBtcAddress: PublicKey
    let vaultEthAddress: PublicKey
    let bobBtcAddress: PublicKey
    let bobEthAddress: PublicKey
    let aliceBtcAddress: PublicKey
    let aliceEthAddress: PublicKey

    let btcMint: PublicKey
    let ethMint: PublicKey

    before(async () => {
        const signature = await connection.requestAirdrop(
            bob.publicKey,
            3 * LAMPORTS_PER_SOL
        )

        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash()

        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature,
        })
    })

    before(async () => {
        const signature = await connection.requestAirdrop(
            alice.publicKey,
            3 * LAMPORTS_PER_SOL
        )

        const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash()

        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature,
        })
    })

    before(async () => {
        btcMint = await createMint(
            connection,
            bob,
            bob.publicKey,
            null,
            9,
            undefined,
            {},
            TOKEN_PROGRAM_ID
        )

        ethMint = await createMint(
            connection,
            bob,
            bob.publicKey,
            null,
            9,
            undefined,
            {},
            TOKEN_PROGRAM_ID
        )



        vaultBtcAddress = await getAssociatedTokenAddress(btcMint, vault, true)
        vaultEthAddress = await getAssociatedTokenAddress(ethMint, vault, true)


        bobBtcAddress = (
            await getOrCreateAssociatedTokenAccount(
                connection,
                bob,
                btcMint,
                bob.publicKey
            )
        ).address

        bobEthAddress = (
            await getOrCreateAssociatedTokenAccount(
                connection,
                bob,
                ethMint,
                bob.publicKey
            )
        ).address

        aliceBtcAddress = (
            await getOrCreateAssociatedTokenAccount(
                connection,
                bob,
                btcMint,
                bob.publicKey
            )
        ).address

        aliceEthAddress = (
            await getOrCreateAssociatedTokenAccount(
                connection,
                bob,
                ethMint,
                bob.publicKey
            )
        ).address


        await mintTo(connection, bob, btcMint, bobBtcAddress, bob, 21_000_000)

        await mintTo(connection, bob, ethMint, bobEthAddress, bob, 100_000_000)
    })

    it("Can lock tokens!", async () => {
        const amount = new BN(5_000_000)
        const deadline = new BN(Math.floor(Date.now() / 1000) - 5) // 5 secs before now
        const lockId = 0

        const timedLock = getTimedLock(bob.publicKey, btcMint, lockId)

        await program.methods
            .lock(amount, deadline)
            .accounts({
                vault,
                locker: bobLocker,
                timedLock,
                tokenAccountOfVault: vaultBtcAddress,
                tokenAccountOfSigner: bobBtcAddress,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()

        const account = await program.account.timedLock.fetch(timedLock)

        assert(account.deadline.eq(deadline))
        assert(account.id === 0)
        assert(account.locker.equals(bob.publicKey))
        assert(account.mint.equals(btcMint))
        assert(account.tokenAmount.eq(amount))

        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobBtcAddress)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultBtcAddress)).value.amount

        assert(bobRemainingBalance === String(21_000_000 - 5_000_000))
        assert(vaultNewBalance === String(5_000_000))
    })

    it("Can unlock tokens!", async () => {
        const lockId = 0

        const timedLock = getTimedLock(bob.publicKey, btcMint, lockId)

        await program.methods
            .unlock(lockId)
            .accounts({
                vault,
                locker: bobLocker,
                timedLock,
                tokenAccountOfVault: vaultBtcAddress,
                tokenAccountOfSigner: bobBtcAddress,
                signer: bob.publicKey,
                mint: btcMint,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([bob])
            .rpc()

        // timedLock account is closed
        // const account = await program.account.timedLock.fetch(timedLock)



        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobBtcAddress)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultBtcAddress)).value.amount

        assert(bobRemainingBalance === String(21_000_000))
        assert(vaultNewBalance === String(0))
    })
})
