<script>
    import Header from "./header.svelte"
    import SearchBar from "./SearchBar.svelte"
    import SearchResultsContainer from "./SearchResultsContainer.svelte";
    import {onMount} from "svelte";
    import {read_get} from "./libs";

    let username = localStorage.getItem('username')
    let searchResultsContainer
    let searchBar

    function activateSearch(e) {
        searchResultsContainer.startSearch(e.detail.text)
    }

    onMount(() => {
        let query = read_get()['search']

        if (query != undefined && query.length != 0) {
            searchBar.readFromGet(query)
            searchResultsContainer.startSearch(query.replace(/%20/g, ' '))
        }
    })
</script>

<div class="container">
    {#if username}
        <Header username={username}/>
    {:else}
        <Header/>
    {/if}
    <SearchBar bind:this={searchBar} on:startSearch={activateSearch}/>
    <SearchResultsContainer bind:this={searchResultsContainer}/>
</div>
