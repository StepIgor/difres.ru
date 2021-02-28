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
      var result_found = [];
      var user_query = document.getElementById("search_textbox").value.toLowerCase();
      search_db.forEach(function(website, i, search_db){
        var hits = 0;
        keywords_page = website[2];
        website[2].forEach(function(keyword, i, keywords_page){
          if (user_query.indexOf(keyword) != -1){
            hits++;
          }
        });
        if (hits != 0){
          result_found.push([website, hits]);
          counter++;
        }
      });

      result_found.sort((prev, next) => next[1] - prev[1]);
      result_found.forEach(function(website, i, result_found){
        let icon_url = website[0][1].split("/")[0] + "/favicon.png";
        document.getElementById("found").innerHTML += '<div class="col s12 m12 l12"><a href="https://'+website[0][1]+'" target="_blank"><div class="card hoverable grey lighten-5" style="cursor:pointer;"><div class="card-content"><span class="card-title"><img src="https://'+icon_url+'" style="width:24px;vertical-align:middle;"> <span style="vertical-align:middle;">'+website[0][0]+'</span></span><span class="grey-text">'+website[0][1]+'</span></div></div></a></div>';
      });

      document.getElementById("total_found_counter").innerHTML = counter;
      document.getElementById('found_block').style.display = "block";
    }
  }
});


//read get parameter
if (read_get()['search'] != null){
  document.getElementById('search_textbox').value = decodeURIComponent(read_get()['search']);
  let ev = new KeyboardEvent('keypress', {'key':'Enter'});
  document.dispatchEvent(ev);
}


//hide results block
eid('hide_results_but').addEventListener('click', function(e){
  eid('found_block').style.display = 'none';
});
