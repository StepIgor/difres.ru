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
function findCommonElements_fast(arr1, arr2) {
    return arr1.some(item => arr2.includes(item))
}
