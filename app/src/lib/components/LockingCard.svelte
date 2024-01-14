<script lang="ts">
	import type { SolanaVestingProgram } from "$lib/program"
	import { solana, connection } from "$lib/solana.svelte"
	import type { BN, Program } from "@coral-xyz/anchor"

	type Lockings = Awaited<ReturnType<Program<SolanaVestingProgram>["account"]["locking"]["all"]>>

	type Locking = Lockings extends Array<infer T> ? T : never

	let { locking } = $props<{ locking: Locking }>()

	const datetimeFormat = new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium"
	})

	function secsToDate(secs: BN) {
		const date = new Date(parseInt(secs.toString()) * 1000)

		return datetimeFormat.format(date)
	}

	async function getDecimals() {
		try {
			return (await connection.getTokenSupply(locking.account.mint)).value.decimals
		} catch (error) {
			alert("An error is thrown!")
			console.log("below is the error thrown:")
			console.log(error)
			throw Error("can't get decimals")
		}
	}

	async function unlock() {
		try {
			await solana.unlock({
				receiver: locking.account.receiver,
				mint: locking.account.mint
			})
		} catch (error) {
			alert("An error is thrown!")
			console.log("below is the error thrown:")
			console.log(error)
		}
	}

	function addPoint(number: string, decimals: number): string {
		if (decimals >= number.length) {
			const zeroCount = decimals - number.length + 1
			number = "0".repeat(zeroCount) + number
		}

		const left = number.slice(0, -decimals)
		const right = number.slice(-decimals)
		return left + "." + right
	}
</script>

<div class="flex flex-col gap-4 rounded-xl bg-neutral-700 p-4">
	<div class="flex flex-col gap-2">
		<p>Token: {locking.account.mint.toBase58()}</p>
		{#await getDecimals() then decimals}
			<p>Amount Locked: {addPoint(locking.account.amount.toString(), decimals)}</p>
			<p>Amount Unlocked: {addPoint(locking.account.amountUnlocked.toString(), decimals)}</p>
		{/await}
		<p>Start Date: {secsToDate(locking.account.startDate)}</p>
		<p>End Date: {secsToDate(locking.account.endDate)}</p>
		<p>Receiver: {locking.account.receiver.toBase58()}</p>
	</div>
	<button
		class="h-10 rounded-full bg-indigo-500 font-semibold hover:bg-indigo-400 disabled:cursor-not-allowed"
		onclick={unlock}
		disabled={!solana.address}>Unlock</button
	>
</div>
