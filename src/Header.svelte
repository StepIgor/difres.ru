<script>
  import {onMount} from 'svelte';
  import {fade, fly} from "svelte/transition"

  export let username = 'пользователь'
  let visible = false
  let editmode = false
  let newUsername

  onMount(() => {
    visible = true
  })

  function saveNewName(){
    if (newUsername != undefined && newUsername.length != 0 && newUsername.replace(/ /g,'').length != 0){
      localStorage.setItem('username', newUsername)
      username = newUsername
      editmode = false
    }
  }
</script>

{#if visible}
<div transition:fade="{{duration:1000}}" class="row center-align">
  <h4 class="light">Добро пожаловать, <span class="username_container" on:click={() => editmode = !editmode}>{username}</span>!</h4>
</div>
{/if}
{#if editmode}
<div transition:fly="{{y:-100, duration: 400}}" class="row center-align">
  <div class="col s8 m10 l10 input-field">
    <input bind:value={newUsername} type="text" placeholder="Как к вам обращаться?">
  </div>
  <div class="col s4 m2 l2">
    <button type="button" on:click={saveNewName} class="btn blue darken-3 waves-effect waves-light saveNameBtn">Сохранить</button>
  </div>
</div>
{/if}


<style>
.username_container {
  cursor: pointer;
}
.saveNameBtn {
  margin-top: 20px;
  margin-left: -5px;
}
</style>
