//Библиотека полезных мелочей
//Собрал файл - @stepigor (blog.difres.ru)

//Версия файла 1.0

//Приятного вам кодинга!


//Аналог функции в PHP
function htmlspecialchars(text) {
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}


//Обратно преобразует строку после htmlspecialchars
function cancelhtmlspecialchars(str){
  return str.replace(/<br \/>/g,"\n").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"").replace(/&#039;/g,"'").replace(/&amp;/g,"&");
}



//проверить, есть ли хотя бы один общий элемент в двух массивах
function haveCommonElements(arr1, arr2) {
    return arr1.some(item => arr2.includes(item))
}


// случайное число от min до (max+1)
function randomInteger(min, max) {
  let rand = min + Math.random() * (max + 1 - min);
  return Math.floor(rand);
}


//чтение get-параметров
function read_get() {
var vars = {};
var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
  vars[key] = value;
});
return vars;
}


//быстрое обращение к элементу документа
function eid(id){
  return document.getElementById(id);
}
