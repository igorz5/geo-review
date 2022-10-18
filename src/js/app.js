const formTemplate = `
 <form class="balloon">
    <ul class="balloon__review-list"></ul>
    <h3 class="balloon__title">Отзыв:</h3>
    <div class="balloon__inner">
      <input class="balloon__input" type="text" placeholder="Укажите ваше имя" name="name" required>
      <input class="balloon__input" type="text" placeholder="Укажите место" name="place" required>
      <textarea class="balloon__input" placeholder="Оставить отзыв" name="message" required></textarea>
    </div>
    <div class="balloon__footer">
      <button class="balloon__btn">Добавить</button>
    </div>
 </form>
`;

const ymapsKey = process.env.YMAPS_API_KEY;

export default class App {
  constructor(root) {
    if (typeof root === "string") {
      this.root = document.querySelector(root);
      return;
    }

    this.root = root;
  }

  onInit = () => {
    this.map = new ymaps.Map(this.root, {
      center: [55.76, 37.64],
      zoom: 10,
      controls: ["zoomControl"],
    });

    this.clusterer = new ymaps.Clusterer({ clusterDisableClickZoom: true });
    this.map.geoObjects.add(this.clusterer);

    this.map.events.add("click", this.onClick);
    document.addEventListener("submit", this.onDocumentSubmit);

    this.loadPlacemarks();
  };

  onClick = (e) => {
    const coords = e.get("coords");
    const content = App.createBalloonContent(coords);

    this.map.balloon.open(coords, content);
  };

  onDocumentSubmit = (e) => {
    if (e.target.className === "balloon") {
      e.preventDefault();

      const elems = e.target.elements;
      const name = elems.name.value;
      const place = elems.place.value;
      const message = elems.message.value;

      const coords = JSON.parse(e.target.dataset.coords);
      App.saveReview(coords, {
        name,
        place,
        message,
      });

      this.clusterer.removeAll();
      this.loadPlacemarks();

      this.map.balloon.close();
    }
  };

  init() {
    this.loadYMaps();
  }

  loadYMaps() {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1?apikey=${ymapsKey}&lang=ru_RU`;
    script.addEventListener("load", () => {
      ymaps.ready(this.onInit);
    });

    document.body.appendChild(script);
  }

  loadPlacemarks() {
    const data = App.loadReviews();
    for (const key of Object.keys(data)) {
      this.addPlacemark(App.keyToCoords(key));
    }
  }

  async addPlacemark(coords) {
    const address = await App.getAddress(coords);
    const placemark = new ymaps.Placemark(coords, {
      clusterCaption: address,
    });

    this.clusterer.events.add("click", () => {
      const reviews = App.loadReviewsByCoords(coords);
      placemark.properties.set(
        "balloonContent",
        App.createBalloonContent(coords, reviews)
      );
    });

    this.clusterer.add(placemark);
  }

  static createBalloonContent(coords, reviews = []) {
    const root = document.createElement("div");
    root.innerHTML = formTemplate;

    const form = root.querySelector(".balloon");
    form.dataset.coords = JSON.stringify(coords);

    const list = root.querySelector(".balloon__review-list");

    for (const review of reviews) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="review">
          <div class="review__header">
            <div class="review__name">${review.name}</div>
            <div class="review__place">${review.place}</div>
            <div class="review__date">${review.date}</div>
          </div>
          <p class="review__message">${review.message}</p>
        </div>
      `;

      list.append(li);
    }

    return root.innerHTML;
  }

  static coordsToKey(coords) {
    return `${coords[0]}_${coords[1]}`;
  }

  static keyToCoords(key) {
    return key.split("_").map(Number);
  }

  static saveReview(coords, data) {
    const item = localStorage.getItem("reviews");
    let reviews = {};
    if (item != null) {
      reviews = JSON.parse(item);
    }

    const key = App.coordsToKey(coords);
    if (!reviews[key]) {
      reviews[key] = [];
    }

    reviews[key].push({
      ...data,
      date: new Date().toLocaleDateString().replace(/\//g, "."),
    });

    localStorage.setItem("reviews", JSON.stringify(reviews));
  }

  static loadReviewsByCoords(coords) {
    const reviews = App.loadReviews();
    const key = App.coordsToKey(coords);

    return reviews[key] ? reviews[key] : [];
  }

  static loadReviews() {
    const item = localStorage.getItem("reviews");
    if (item == null) {
      return {};
    }

    return JSON.parse(item);
  }

  static async getAddress(coords) {
    try {
      const res = await ymaps.geocode(coords);
      const firstGeoObject = res.geoObjects.get(0);

      return firstGeoObject.getAddressLine();
    } catch {
      return "Неизвестно";
    }
  }
}
