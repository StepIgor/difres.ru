<script>
    import {fly, fade} from "svelte/transition"
    import SearchResultBlock from "./SearchResultBlock.svelte"
    import {websites} from "./database"

    let visible = false
    let results = []

    export function startSearch(query) {
        results = []
        query = query.toLowerCase().split(" ")
        websites.forEach(function (website, i) {
            let hits = 0
            let keywords = website[0].split(' ')
            keywords.forEach(function (keyword) {
                if (["|"].indexOf(keyword) == -1) {
                    if (query.indexOf(keyword.toLowerCase()) != -1) {
                        hits++
                    }
                }
            })
            if (query.indexOf(website[1].split('?')[0]) != -1 || query.indexOf(website[1].split('/')[0]) != -1) {
                hits = hits + 2
            }
            if (query.indexOf(website[1].toLowerCase()) != -1) {
                hits = hits + 5
            }
            if (hits > 0) {
                results.push([i, hits])
            }
        })

        results.sort((p, n) => n[1] - p[1])
        visible = true
    }
</script>

{#if visible}
    <div in:fly="{{y:-200}}" out:fly="{{y:-200}}" class="row">
        <div class="col s8 l10 m10 left-align">
            <h5 class="header">Результаты поиска ({results.length}):</h5>
        </div>
        <div class="col s4 m2 l2 right-align">
            <span class="blue-text hide-btn" on:click={()=>visible = false}>Скрыть</span>
        </div>
    </div>
    <div class="row">
        {#each results as website}
            <div transition:fade="{{duration:200}}">
                <SearchResultBlock title={websites[website[0]][0]} url={websites[website[0]][1]}
                                   icon={websites[website[0]][1].split("/")[0] + "/favicon.png"}/>
            </div>
        {/each}
    </div>
{/if}

<style>
    .header {
        font-weight: bold;
    }

    .hide-btn {
        cursor: pointer;
    }
</style>