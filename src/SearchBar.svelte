<script>
  import {onMount} from 'svelte';
  import {fly} from "svelte/transition"
  import {createEventDispatcher} from 'svelte';

  let visible = false
  const dispatch = createEventDispatcher();
  let searchText

  onMount(()=>{
    visible = true
  })

  function startSearch(e){
    if (e.keyCode == 13){
        dispatch('startSearch', {
  			   text: searchText
		    });
    }
  }

  export function readFromGet(query){
    searchText = query.replace(/%20/g, ' ')
  }
</script>

{#if visible}
  <div transition:fly="{{y:100, duration:1000}}" class="row center-align">
    <div class="col-content s12 m12 l12">
      <input on:keydown={startSearch} bind:value={searchText} type="text" class="searchLine" placeholder="Начните поиск...">
      <div class="left-align servicesLinks">
        <a href="https://video.difres.ru" class="blue-text" target="_blank">Видео</a>
        <span class="linksNext">
        <a href="https://schedule.difres.ru" class="blue-text" target="_blank">Расписание</a>
        <a href="https://jsstore.difres.ru" class="blue-text" target="_blank">JS Store</a>
        <a href="https://qna.difres.ru" class="blue-text" target="_blank">Вопросы и ответы</a>
        <a href="https://gradientwallpapers.difres.ru" class="blue-text" target="_blank">Коллекция обоев</a>
        <a href="https://blog.difres.ru" class="blue-text" target="_blank">Блог разработчика</a>
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
.searchLine {
  background:#fff;
  padding:5px;
}
.servicesLinks {
  white-space:nowrap;
  overflow-x:auto;
  font-size:18px;
}
.linksNext > * {
  margin-left:10px;
}
</style>
