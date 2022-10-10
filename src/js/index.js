const mapRoot = document.getElementById("map");

const onMapReady = (map) => {
  map.events.add("click", (e) => {
    if (!map.balloon.isOpen()) {
      const coords = e.get("coords");

      map.balloon.open(coords, {
        content: `
          <div class="balloon">
            <h3 class="balloon__title">Отзыв:</h3>
            <form class="balloon__form" >
              <input class="balloon__input" type="text" placeholder="Укажите ваше имя" />
              <input class="balloon__input" type="text" placeholder="Укажите место" />
              <textarea class="balloon__input" placeholder="Оставьте отзыв"></textarea>
              <div className="balloon__form-footer">
                <button class="balloon__btn">Добавить</button>
              </div>
            </form>
          </div>
        `,
      });
    } else {
      map.balloon.close();
    }
  });
};

ymaps.ready(() => {
  const map = new ymaps.Map(mapRoot, {
    center: [55.76, 37.64],
    zoom: 10,
  });

  onMapReady(map);
});
