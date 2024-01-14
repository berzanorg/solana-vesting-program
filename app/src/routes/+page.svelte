<script lang="ts">
	import LockingCard from "$lib/components/LockingCard.svelte"
	import { solana, connection } from "$lib/solana.svelte"
	import { PublicKey } from "@solana/web3.js"
	import BN from "bn.js"

	let tokenContractAddress: string | undefined = $state()
	let receiverAddress: string | undefined = $state()
	let tokenAmount: string | undefined = $state()
	let startDate: string | undefined = $state()
	let endDate: string | undefined = $state()

	async function lock(e: SubmitEvent) {
		e.preventDefault()

		try {
			const token_contract_address = new PublicKey(tokenContractAddress!)
			const receiver_address = new PublicKey(receiverAddress!)
			const token_decimals = (await connection.getTokenSupply(token_contract_address)).value
				.decimals
			const token_amount = new BN(tokenAmount!).mul(new BN(10).pow(new BN(token_decimals)))
			const start_date = new BN(Math.round(new Date(startDate!).getTime() / 1000))
			const end_date = new BN(Math.round(new Date(endDate!).getTime() / 1000))

			await solana.lock({
				amount: token_amount,
				receiver: receiver_address,
				mint: token_contract_address,
				startDate: start_date,
				endDate: end_date
			})
		} catch (error) {
			alert("An error is thrown!")
			console.log("below is the error thrown:")
			console.log(error)
		}
	}
</script>

<section class="flex flex-col gap-4">
	<h1 class="text-center text-3xl font-semibold">Lock Tokens</h1>
	<form class="flex flex-col gap-4" onsubmit={lock}>
		<div class="flex flex-col gap-1.5">
			<p class="font-semibold">Token's Contract Address:</p>
			<input
				class="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-neutral-200 outline-none placeholder:text-neutral-600"
				placeholder="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
				bind:value={tokenContractAddress}
				required
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<p class="font-semibold">Token Amount:</p>
			<input
				class="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-neutral-200 outline-none placeholder:text-neutral-600"
				placeholder="21000.0"
				type="number"
				bind:value={tokenAmount}
				required
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<p class="font-semibold">Start Date:</p>
			<input
				class="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-neutral-200 outline-none placeholder:text-neutral-600"
				type="date"
				bind:value={startDate}
				required
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<p class="font-semibold">End Date:</p>
			<input
				class="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-neutral-200 outline-none placeholder:text-neutral-600"
				type="date"
				bind:value={endDate}
				required
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<p class="font-semibold">Receiver Address:</p>
			<input
				class="h-10 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-neutral-200 outline-none placeholder:text-neutral-600"
				placeholder="3emsAVdmGKERbHjmGfQ6oZ1e35dkf5iYcS6U4CPKFVaa"
				bind:value={receiverAddress}
				required
			/>
		</div>
		<button
			class="h-10 rounded-full bg-indigo-500 font-semibold hover:bg-indigo-400 disabled:cursor-not-allowed"
			type="submit"
			disabled={!solana.address}>Lock</button
		>
	</form>
</section>

<section class="flex flex-col gap-8">
	{#if solana.lockings && solana.lockings.length > 0}
		<h1 class="text-center text-3xl font-semibold">Unlock Tokens</h1>
		{#each solana.lockings as locking}
			<LockingCard {locking} />
		{/each}
	{/if}
</section>
