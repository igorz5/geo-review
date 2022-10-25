const formTemplate = `
 <form class="balloon-form">
    <h4 class="balloon-form__title">Отзыв:</h4>
    <input class="balloon-form__input" type="text" placeholder="Укажите ваше имя" name="name" required>
    <input class="balloon-form__input" type="text" placeholder="Укажите место" name="place" required>
    <textarea class="balloon-form__input" placeholder="Оставить отзыв" name="message" required></textarea>
    <div class="balloon-form__footer">
      <button class="balloon-form__btn">Добавить</button>
    </div>
 </form>
`;

class Storage {
  constructor(name) {
    if (typeof name !== "string") {
      throw new Error("The storage name must be a string");
    }

    this.data = [];
    this.name = name;

    this.load();
  }

  load() {
    const item = localStorage.getItem(this.name);
    let data = [];

    if (item) {
      try {
        data = JSON.parse(item);
      } catch (error) {
        console.error(`Failed to parse storage data: ${this.name}`);
      }
    }

    this.data = data;
  }

  save(item) {
    this.data.push(item);
    localStorage.setItem(this.name, JSON.stringify(this.data));
  }

  getData() {
    return this.data;
  }
}

const ymapsKey = process.env.YMAPS_API_KEY;
export default class App {
  constructor(root) {
    this.currentCoords = [0, 0];
    this.currentId = 0;

    if (typeof root === "string") {
      this.root = document.querySelector(root);
      return;
    }

    this.root = root;
  }

  onInit = () => {
    this.storage = new Storage("georeview");

    this.map = new ymaps.Map(this.root, {
      center: [55.76, 37.64],
      zoom: 10,
      controls: ["zoomControl"],
    });

    this.map.events.add("click", this.onClick);
    document.addEventListener("submit", this.onDocumentSubmit);

    const openBalloon = (obj) => {
      const reviews = this.storage.getData().filter((review) => {
        const coordsA = obj.geometry.coordinates;
        const coordsB = review.coords;
        return coordsA[0] === coordsB[0] && coordsA[1] === coordsB[1];
      });

      const reviewsItems = [];
      const { data } = obj.properties;

      reviews.forEach((review) => {
        const { name, place, date, message } = review;
        const reviewLayout = `
          <li class="balloon__review-item">
            <div class="review">
              <div class="review__header">
                <div class="review__name">${name}</div>
                <div class="review__place">${place}</div>
                <div class="review__date">${date}</div>
              </div>
              <p class="review__message">${message}</p>
            </div>
          </li>
        `;

        reviewsItems.push(reviewLayout);
      });

      const layout = `
        <div class="balloon">
          <div class="balloon__address">${data.address}</div>
          <ul class="balloon__review-list">
            ${reviewsItems.join("")}
          </ul>
          ${formTemplate}
        </div>
      `;

      this.map.balloon.open(data.coords, layout);
    };

    const balloonContentLayout = ymaps.templateLayoutFactory.createClass(
      `
      <div class="balloon">
        <a href="#" class="balloon__link balloon__address-link">{{properties.data.address}}</a>
        <div class="review">
          <div class="review__header">
            <div class="review__name">{{properties.data.name}}</div>
            <div class="review__place">{{properties.data.place}}</div>
            <div class="review__date">{{properties.data.date}}</div>
          </div>
          <p class="review__message">{{properties.data.message}}</p>
        </div>
      </div>
    `,
      {
        build() {
          this.constructor.superclass.build.call(this);

          const link = this._element.querySelector(".balloon__address-link");
          link.addEventListener("click", (e) => {
            e.preventDefault();

            const obj = this.getData().geoObject;

            openBalloon(obj);
          });
        },
      }
    );

    this.objectManager = new ymaps.ObjectManager({
      clusterDisableClickZoom: true,
      clusterize: true,
      clusterBalloonItemContentLayout: balloonContentLayout,
      clusterBalloonContentLayout: "cluster#balloonCarousel",
    });

    this.objectManager.objects.events.add("click", (e) => {
      const obj = this.objectManager.objects.getById(e.get("objectId"));

      this.currentCoords = obj.geometry.coordinates;
    });

    this.objectManager.clusters.events.add("click", async (e) => {
      const cluster = this.objectManager.clusters.getById(e.get("objectId"));
      const objs = cluster.properties.geoObjects;

      this.currentCoords = objs[0].geometry.coordinates;
    });

    this.loadPlacemarks();

    this.map.geoObjects.add(this.objectManager);
  };

  onClick = async (e) => {
    if (!this.map.balloon.isOpen()) {
      this.currentCoords = e.get("coords");

      const address = await App.getAddress(this.currentCoords);
      this.map.balloon.open(this.currentCoords, {
        contentHeader: address,
        contentBody: formTemplate,
      });
    } else {
      this.map.balloon.close();
    }
  };

  onDocumentSubmit = async (e) => {
    if (e.target.className === "balloon-form") {
      e.preventDefault();

      const elems = e.target.elements;

      const item = {
        name: elems.name.value,
        place: elems.place.value,
        message: elems.message.value,
        date: new Date().toLocaleDateString().replace(/\//g, "."),
        coords: this.currentCoords,
      };

      this.storage.save(item);

      const placemark = await this.createPlacemark(item);
      this.objectManager.add(placemark);
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
    this.storage.getData().forEach(async (item) => {
      const placemark = await this.createPlacemark(item);
      this.objectManager.add(placemark);
    });
  }

  async createPlacemark(data) {
    const { coords, name, place, message, date } = data;
    const address = await App.getAddress(coords);

    const reviewsLayout = `
      <div class="balloon">
        <div class="balloon__address">${address}</div>
        <ul class="balloon__review-list">
          <li class="balloon__review-item">
            <div class="review">
              <div class="review__header">
                <div class="review__name">${name}</div>
                <div class="review__place">${place}</div>
                <div class="review__date">${date}</div>
              </div>
              <p class="review__message">${message}</p>
            </div>
          </li>
        </ul>
        ${formTemplate}
      </div>
    `;

    return {
      id: this.currentId++,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {
        balloonContent: reviewsLayout,
        data: {
          name: name,
          place: place,
          message: message,
          date: date,
          address: address,
        },
      },
    };
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
