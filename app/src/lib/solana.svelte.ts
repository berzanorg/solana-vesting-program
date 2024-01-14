import { PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js"
import { Connection } from "@solana/web3.js"
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor"
import IDL from "$lib/idl.json"
import type { SolanaVestingProgram } from "./program"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import { Buffer as BufferPolyfill } from "buffer"

declare const Buffer: typeof BufferPolyfill
globalThis.Buffer = BufferPolyfill

import type BN from "bn.js"

interface WindowWithSolana extends Window {
	solana?: {
		publicKey: PublicKey
		connect: () => Promise<{ publicKey: PublicKey }>
		disconnect: () => Promise<void>
		signAllTransactions: <T extends Transaction | VersionedTransaction>(
			txs: Array<T>
		) => Promise<Array<T>>
		signTransactions: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
	}
}

declare const window: WindowWithSolana

const programId = new PublicKey("J1q6xFrv2pj5Q1YFjwK2J4nwvZE5pJFtkmvE5jmcy3bJ")
export const connection = new Connection("https://wanda-7d5t1j-fast-devnet.helius-rpc.com/")

const getVault = () => {
	return PublicKey.findProgramAddressSync([Buffer.from("vault")], programId)[0]
}

const getLocking = (receiver: PublicKey, mint: PublicKey) => {
	return PublicKey.findProgramAddressSync(
		[Buffer.from("locking"), receiver.toBuffer(), mint.toBuffer()],
		programId
	)[0]
}

function createSolana() {
	let address: string | undefined = $state()
	let lockings:
		| Awaited<ReturnType<Program<SolanaVestingProgram>["account"]["locking"]["all"]>>
		| undefined = $state()
	let program: Program<SolanaVestingProgram> | undefined

	async function connect() {
		if (!window.solana) {
			alert("Phantom wallet is not found!")
			return
		}

		try {
			const result = await window.solana.connect()
			address = result.publicKey.toBase58()

			const provider = new AnchorProvider(
				connection,
				window.solana as never,
				AnchorProvider.defaultOptions()
			)

			program = new Program(
				IDL as Idl,
				programId,
				provider
			) as unknown as Program<SolanaVestingProgram>

			lockings = await program.account.locking.all()
		} catch (error) {
			console.log(error)
		}
	}

	async function disconnect() {
		if (!window.solana) {
			alert("Phantom wallet is not found!")
			return
		}

		await window.solana.disconnect()
		address = undefined
	}

	async function lock(params: {
		receiver: PublicKey
		amount: BN
		startDate: BN
		endDate: BN
		mint: PublicKey
	}) {
		if (!program || !address) return alert("Unexpected Error")

		try {
			const signer = new PublicKey(address)
			const vault = getVault()
			const locking = getLocking(params.receiver, params.mint)
			const vaultAta = await getAssociatedTokenAddress(params.mint, vault, true)
			const signerAta = await getAssociatedTokenAddress(params.mint, signer, false)

			const mint = params.mint

			await program.methods
				.lock(params.receiver, params.amount, params.startDate, params.endDate)
				.accounts({
					vault,
					locking,
					vaultAta,
					signerAta,
					signer,
					mint,
					tokenProgram: TOKEN_PROGRAM_ID
				})
				.rpc()
		} catch (error) {
			alert("An error is thrown!")
			console.log("below is the error thrown:")
			console.log(error)
		}
	}

	async function unlock(params: { receiver: PublicKey; mint: PublicKey }) {
		if (!program || !address) return alert("Unexpected Error")
		try {
			const signer = new PublicKey(address)
			const vault = getVault()
			const locking = getLocking(params.receiver, params.mint)
			const vaultAta = await getAssociatedTokenAddress(params.mint, vault, true)
			const receiverAta = await getAssociatedTokenAddress(params.mint, params.receiver, false)
			const receiver = params.receiver

			const mint = params.mint

			await program.methods
				.unlock()
				.accounts({
					vault,
					locking,
					vaultAta,
					receiverAta,
					receiver,
					signer,
					mint,
					tokenProgram: TOKEN_PROGRAM_ID
				})
				.rpc()
		} catch (error) {
			alert("An error is thrown!")
			console.log("below is the error thrown:")
			console.log(error)
		}
	}

	return {
		get address() {
			return address
		},
		get lockings() {
			return lockings
		},
		connect,
		disconnect,
		lock,
		unlock
	}
}

export const solana = createSolana()
