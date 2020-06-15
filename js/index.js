if (localStorage.getItem('username') == null){
  localStorage.setItem('username','пользователь');
}

$(document).ready(function(){
  $('#username').text(localStorage.getItem('username'));
});

//change username
document.getElementById('username').addEventListener('click',function(){
  $('#change_username_line').css({'display':'block'});
});

document.getElementById('apply_new_username').addEventListener('click',function(){
  new_name = $('#new_username').val();

  if (new_name.length != 0 && new_name.replace(/ /g,'').length != 0){
    localStorage.setItem('username', htmlspecialchars(new_name));
    $('#change_username_line').css({'display':'none'});
    $('#username').text(localStorage.getItem('username'));
  }
});

//start search

document.addEventListener('keypress',function(e){
  if (e.key == 'Enter'){
    if (document.getElementById('search_textbox').value.replace(/ /g, '') != ''){
      document.getElementById("found").innerHTML = "";
      var counter = 0;
      var user_query = document.getElementById("search_textbox").value.toLowerCase();
      user_query = user_query.split(' ');
      search_db.forEach(function(website, i, search_db){
        if (findCommonElements_fast(website[2], user_query) == true){
          document.getElementById("found").innerHTML += '<div class="col s12 m12 l12"><a href="https://'+website[1]+'" target="_blank"><div class="card hoverable grey lighten-5" style="cursor:pointer;"><div class="card-content"><span class="card-title">'+website[0]+'</span><span class="grey-text">'+website[1]+'</span></div></div></a></div>';
          counter += 1;
        }
      });
      document.getElementById("total_found_counter").innerHTML = counter;
      document.getElementById('found_block').style.display = "block";
    }
  }
});
