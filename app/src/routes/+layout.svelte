<script>
	import Footer from "$lib/components/Footer.svelte"
	import Header from "$lib/components/Header.svelte"
	import "../app.css"
</script>

<Header />

<main class="flex w-full max-w-xl flex-1 flex-col gap-32 self-center px-4 py-4 md:px-8">
	<slot />
</main>
<Footer />
