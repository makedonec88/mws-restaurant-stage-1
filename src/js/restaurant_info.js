import registerGoogleMap from './registerGoogleMap';
import DBHelper from './dbhelper';
import registerSW from './registerSW';

/**
 * RegisterSW
 */
registerSW();

const globals = {
  restaurant: undefined,
  reviews: undefined,
  map: undefined,
};

/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = (callback) => {
  if (globals.restaurant) { // restaurant already fetched!
    callback(null, globals.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      if (!restaurant) {
        console.error(error);
        return;
      }
      globals.restaurant = restaurant;
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = globals.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = DBHelper.imageAltTextForRestaurant(restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML += restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fetchReviewsFromURL(restaurant.id);
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
const fillRestaurantHoursHTML = (operatingHours = globals.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Get current restaurant reviews.
 */

const fetchReviewsFromURL = (id) => {
  if (globals.reviews) {
    return;
  }

  DBHelper.fetchReviewsById(id, (error, reviews) => {
      if (!reviews) {
          console.error(error);
          return;
      }
      globals.reviews = reviews;
      fillReviewsHTML(reviews);
  });
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
const fillReviewsHTML = (reviews = globals.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

const resetReviewsHTML = () => {
  const container = document.getElementById('reviews-container');
  container.innerHTML = '<ul id="reviews-list"></ul>';
  fillReviewsHTML();
};

/**
 * Create review HTML and add it to the webpage.
 */
const createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt);
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
const fillBreadcrumb = (restaurant=globals.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('aria-current', 'page');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
const getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

const loadMap = (restaurant) => {
    registerGoogleMap().then(google => {
        globals.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 16,
            center: restaurant.latlng,
            scrollwheel: false
        });
        DBHelper.mapMarkerForRestaurant(globals.restaurant, globals.map);
    });
};

/**
 * Initialize Google map, called from HTML.
 */
fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
        console.error(error);
    } else {
        if (window.innerWidth >= 991) {
            loadMap(restaurant);
        } else {
            document.getElementById('load-map').addEventListener('click', (evt) => {
                evt.preventDefault();

                loadMap(restaurant);
            })
        }
        fillBreadcrumb();
    }
});

const form = document.getElementById('submit-review');

form.addEventListener('submit', (evt) => {
  evt.preventDefault();

  const {
    name: { value: name },
    rating: { value: rating },
    comments: { value: comments }
  } = form.elements;

  const id = getParameterByName('id');

  const data = {
      restaurant_id: id,
      name: name,
      rating: rating,
      comments: comments,
  };

  if (!window.navigator.onLine) {
    sendFormLater(data);
    return;
  }

  sendForm(data);
});

const sendFormLater = (data) => {
    if (window.navigator.onLine) {
        sendForm(data);
        return;
    }

    const temptId = `fake${Math.random()}`;

    window.addEventListener('online', () => {
      globals.reviews = globals.reviews.filter(item => item.id !== temptId);
      sendForm(data);
    });

    globals.reviews.push({
        ...data,
        id: temptId,
        updatedAt: Date.now(),
    });
    resetReviewsHTML();
    form.reset();

    alert('You are offline, your meesage will be sent to server after you reconnect')
};

const sendForm = (data) => {
    DBHelper.createReview(data)
      .then(res => {
        if (!globals.reviews) {
            globals.reviews = [];
        }
        globals.reviews.push(res);
        resetReviewsHTML();
        form.reset();
      })
};
