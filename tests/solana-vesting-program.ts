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


    const mintBtc = async (receiver: PublicKey, amount: number) => {
        const { address } = await getOrCreateAssociatedTokenAccount(connection, satoshi, btcMint, receiver)
        await mintTo(connection, satoshi, btcMint, address, satoshi, amount)
    }

    const mintEth = async (receiver: PublicKey, amount: number) => {
        const { address } = await getOrCreateAssociatedTokenAccount(connection, vitalik, ethMint, receiver)
        await mintTo(connection, vitalik, ethMint, address, vitalik, amount)
    }


    const getBtcAddress = async (receiver: PublicKey, allowOwnerOffCurve?: boolean) => {
        const address = await getAssociatedTokenAddress(btcMint, receiver, allowOwnerOffCurve)
        return address
    }

    const getEthAddress = async (receiver: PublicKey, allowOwnerOffCurve?: boolean) => {
        const address = await getAssociatedTokenAddress(ethMint, receiver, allowOwnerOffCurve)
        return address
    }

    const getAirdrop = async (receiver: PublicKey) => {
        const signature = await connection.requestAirdrop(
            receiver,
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
            mintBtc(bob.publicKey, 21),
            mintEth(alice.publicKey, 100),
        ])
    })

    it("Can lock tokens!", async () => {
        const amount = new BN(5)
        const startDate = new BN(Math.floor(Date.now() / 1000) - 5) // 5 secs before now
        const endDate = new BN(Math.floor(Date.now() / 1000) - 3) // 3 secs before now

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
        assert(account.startDate.eq( startDate))
        assert(account.endDate.eq(endDate))
        assert(account.mint.equals(btcMint))
        assert(account.reciever.equals(marley.publicKey))

        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobAta)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultAta)).value.amount

        assert(bobRemainingBalance === String(16))
        assert(vaultNewBalance === String(5))
    })

    it("Can unlock tokens!", async () => {
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

        assert(account.amountUnlocked.eq(new BN(5)))



        const bobRemainingBalance = (await connection.getTokenAccountBalance(bobAta)).value.amount
        const marleyNewBalance = (await connection.getTokenAccountBalance(marleyAta)).value.amount
        const vaultNewBalance = (await connection.getTokenAccountBalance(vaultAta)).value.amount

        assert(bobRemainingBalance === String(16))
        assert(marleyNewBalance === String(5))
        assert(vaultNewBalance === String(0))
    })
})
