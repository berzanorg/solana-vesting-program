<script lang="ts">
	import { solana } from "$lib/solana.svelte"
</script>

<header
	class="sticky left-0 top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-700 bg-neutral-800 px-4 md:px-8"
>
	<a class="font-semibold" href="https://github.com/BerzanOrg/solana-vesting-program">
		Solana Vesting Program
	</a>
	<button
		class="h-10 rounded-full bg-indigo-500 px-7 font-semibold hover:bg-indigo-400"
		onclick={solana.address ? solana.disconnect : solana.connect}
	>
		{solana.address ? "Disconnect" : "Connect"}
	</button>
</header>
