// Initialize and add the map
const markerPath =
  "https://developers.google.com/maps/documentation/javascript/images/marker_green";
const weatherApiKey = "de401d76fda5e4e819dce14ddaee6ebd";
const googleTimezonApiKey = "AIzaSyCuE1f9qfbYhI8lGN0UVhEmek-8vE9NRlY";

let storedHistory = JSON.parse(localStorage.getItem("historyValue")) || [];
let historyEl = $("#history");
let markers = [];
let markerCards = [];
let map;

// Forcast
let isMetric = true; // temp unit in metric

$("#clearHistory").on("click", () => {
  localStorage.clear();
  historyEl.empty();
});

// Backup to ensure it displays at most 15
for (var i = 0; i < 15; i++) {
  if (storedHistory[i]) {
    $("<button>")
      .attr("class", "histBtn")
      .attr("value", storedHistory[i])
      .text(storedHistory[i])
      .appendTo(historyEl);
  }
}

function initMap() {
  // Latitude and Longitude of United States
  const unitedstates = { lat: 37.0902, lng: -95.7129 };
  // The map, centered at United States
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 4.2,
    center: unitedstates,
  });

  searchBoxHandler();
}

$("#history").on("click", ".histBtn", (e) => {
  const locationName = e.currentTarget.value;
  btnSearch(locationName);
});

function btnSearch(locationName) {
  const btnSearch = new google.maps.places.PlacesService(map);

  btnSearch.textSearch({ query: locationName }, (results, status) => {
    if (
      status === google.maps.places.PlacesServiceStatus.OK &&
      results.length > 0
    ) {
      const place = results[0];
      processPlaceRequest(place);
    } else {
      console.warn("No results or failed search:", status);
    }
  });
}

function searchBoxHandler() {
  // This is creating the searchbox
  const searchBox = new google.maps.places.SearchBox(
    document.getElementById("locationSearch")
  );

  // Fires when an input is made or prediction is picked
  google.maps.event.addListener(searchBox, "places_changed", () => {
    const autoCompPlaces = searchBox.getPlaces();

    if (autoCompPlaces.length === 0) {
      return;
    }

    processPlaceRequest(autoCompPlaces[0]);

    document.getElementById("locationSearch").value = "";
  });
}

function processPlaceRequest(place) {
  // Hides the placeholder image and text
  $(".placeholderDesign").addClass("d-none");
  $(".placeholderText").addClass("d-none");

  console.log(place);

  let placeName = place.formatted_address;
  addToHistList(placeName);

  // Get the latitude and longitude of the entered location
  const location = place.geometry.location;
  const local_lng = location.lng();
  const local_lat = location.lat();
  console.log(local_lng + " / " + local_lat);
  // getForecast(local_lat, local_lng, "imperial"); ////
  locationTime(local_lat, local_lng);

  // Search for campgrounds nearby the location
  const service = new google.maps.places.PlacesService(map);
  service.nearbySearch(
    {
      location: location,
      // Searches in a 50km radius
      radius: 50000,
      // Keyword gives more results than type
      keyword: "campground",
    },

    (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        clearResults(); // Clear any existing markers on the map on the lise TODO: fix the label rotation issue
        // Clear any existing markers on the map
        markers.forEach((marker) => {
          marker.setMap(null);
        });
        markers = [];

        // Creates pins on map for each campground
        markerCards = [];
        $(".placeContainer").empty();
        for (let i = 0; i < results.length; i++) {
          createMarker(results[i], i);
        }

        // Fits the map to the bounds of the markers
        let bounds = new google.maps.LatLngBounds();
        markers.forEach((marker) => {
          bounds.extend(marker.getPosition());
        });
        map.fitBounds(bounds);
      } else {
        clearResults();
        let bounds = new google.maps.LatLngBounds(location);

        markers.forEach((marker) => {
          marker.setMap(null);
        });
        map.fitBounds(bounds);
        map.setZoom(5); // set zoom level to 5

        // when the result outcome is 0, create a modal to alert users.
        let noResultModal = $("<div>").attr("class", "noResultModal");
        let nrmContent = $("<div>").attr("class", "nrmContent");
        let nrmClose = $("<button>").attr("class", "closeBtn").text("close");
        let nrmImg = $("<img>").attr("src", "assets/images/noCampingSign.png"); //a searching map or get lost img
        let trailFailText =
          "Trail fail! <br>There is no campground in the searched area.";
        let nrmText = $("<p>").attr("class", "trailFail").html(trailFailText);
        nrmContent.append(nrmImg, nrmText, nrmClose);
        noResultModal.append(nrmContent);
        $("#resultContainer").append(noResultModal);

        noResultModal.show();

        // when users click on "close", the modal disappear
        nrmClose.click(function () {
          noResultModal.hide();
          return;
        });

        // or when users click on anywhere on the screen but outside of the modal, alert disappears.
        $(window).click(function (event) {
          if (!$(event.target).is(noResultModal)) {
            noResultModal.hide();
            return;
          }
        });
      }
    }
  );
}

function addToHistList(value) {
  storedHistory.unshift(value);

  // Sets user input into local storage history after search
  localStorage.setItem(
    "historyValue",
    // Limits to 15 values in search history
    JSON.stringify(storedHistory.slice(0, 15))
  );

  $("<button>")
    .attr("class", "histBtn")
    .attr("value", value)
    .text(value)
    .prependTo(historyEl);
}

let activeMarker = null;
let activePin = null;
let labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function createMarker(place, labelIndex) {
  // Creating label for each pin on map
  const markerIcon = markerPath + labels[labelIndex++ % labels.length] + ".png";
  let marker = new google.maps.Marker({
    map: map,
    position: place.geometry.location,
    icon: markerIcon,
    animation: google.maps.Animation.DROP,
  });

  marker.originalIcon = markerIcon;

  // Making a request to Google Places for additional details
  let service = new google.maps.places.PlacesService(map);
  let request = {
    placeId: place.place_id,
    fields: ["website", "formatted_phone_number", "rating"],
  };

  // Building cards with image and info.
  service.getDetails(request, function (placeDetails, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      const photoUrl =
        place.photos && place.photos.length > 0
          ? place.photos[0].getUrl()
          : "./assets/images/noImage.png";

      const websiteUrl = placeDetails.website ? placeDetails.website : "";
      const phoneNumber = placeDetails.formatted_phone_number
        ? placeDetails.formatted_phone_number
        : "N/A";
      const userRating = placeDetails.rating ? placeDetails.rating : "--";

      // Creating the card that information will be added into
      const $outerDiv = $("<div>").addClass("fadeIn placeCard mb-2");

      const $rowDiv = $("<div>").addClass("row g-0");

      // Image for each card
      const $imgDiv = $("<div>").addClass("col-md-4 col-sm-4 imgContainer");

      const $img = $("<img>")
        .attr("src", photoUrl)
        .addClass("rounded-start locationImage");

      // Contain for each card
      const $cardBodyDiv = $("<div>")
        .addClass("col-md-7 col-sm-7")
        .addClass("placeCard-body");

      const $locationName = $("<h5>")
        .addClass("card-title locationName")
        .text(place.name);

      const $locationAddress = $("<p>")
        .addClass("card-text locationAddress")
        .text(place.vicinity);

      const $phoneIcon = $("<i>")
        .addClass("fa-solid fa-phone")
        .attr("aria-hidden", "true");

      const $locationContact = $("<p>")
        .addClass("card-text locationContact")
        .text(" " + phoneNumber);

      const $websiteLink = $("<a>")
        .attr({ href: websiteUrl, target: "_blank" })
        .text(" Website ")
        .toggleClass("d-none", websiteUrl === "");

      const $externalLinkIcon = $("<i>")
        .addClass("fa fa-external-link")
        .attr("aria-hidden", "true")
        .toggleClass("d-none", websiteUrl === "");

      const $locationRating = $("<p>")
        .addClass("card-text locationRating")
        .text(" User Rating: " + userRating + " / 5");

      // Label for each card
      const $labelDiv = $("<div>")
        .addClass("col-md-1 col-sm-1")
        .addClass("labelContainer");

      const $label = $("<p>")
        .addClass("label")
        .text(labels[labelIndex - 1]);

      $imgDiv.append($img);

      $locationContact.prepend($phoneIcon);

      $websiteLink.append($externalLinkIcon);

      $locationContact.append($websiteLink);

      $cardBodyDiv
        .append($locationName)
        .append($locationAddress)
        .append($locationContact)
        .append($locationRating);

      $labelDiv.append($label);

      $rowDiv.append($imgDiv).append($cardBodyDiv).append($labelDiv);

      $outerDiv.append($rowDiv);

      let activeTimeout = null;
      $outerDiv.on("click", () => {
        map.setCenter(place.geometry.location);

        // When one card is clicked during pin animation
        if (activePin) {
          clearTimeout(activeTimeout);
          activePin.setAnimation(null);
          activePin.setIcon(activePin.originalIcon);
        }

        activePin = marker;

        // Create new icon
        const newIcon = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";

        // Set icon to new icon and apply animation
        marker.setIcon(newIcon);
        marker.setAnimation(google.maps.Animation.BOUNCE);

        // Set timeout to reset icon back to original
        activeTimeout = setTimeout(() => {
          marker.setAnimation(null);
          marker.setIcon(marker.originalIcon);
          activePin = null;
        }, 1400);
      });

      markerCards.push({
        label: labels[(labelIndex - 1) % labels.length],
        element: $outerDiv,
      });

      // Sort cards alphabetically by marker label and append
      markerCards.sort((a, b) => a.label.localeCompare(b.label));
      markerCards.forEach(({ element }) => {
        $(".placeContainer").append(element);
      });
    }
  });

  // Listens for click on marker
  marker.addListener("click", () => {
    // Hide the previous active marker
    if (activeMarker) {
      activeMarker.infoWindow.close();
      activeMarker.setAnimation(null);
    }

    // Set marker as active
    activeMarker = marker;

    // Window for markers, just as a back up
    let content =
      "<strong>" +
      place.name +
      "</strong><br/>" +
      place.vicinity +
      "<br/>" +
      '<a href="https://www.google.com/maps/place/?q=place_id:' +
      place.place_id +
      '" target="_blank">View on Google Maps</a><br/>';

    if (place.photos && place.photos.length > 0) {
      const photoUrl = place.photos[0].getUrl({
        maxWidth: 150,
        maxHeight: 150,
      });
      content += '<img src="' + photoUrl + '"/><br/>';
    }

    // Creates info window and sets the content
    let infoWindow = new google.maps.InfoWindow({
      content: content,
    });
    marker.infoWindow = infoWindow;

    // Opens the info window
    infoWindow.open(map, marker);
  });

  markers.push(marker);
}

function locationTime(lat, lng) {
  $(".timeBox").empty();
  const timestamp_now = Math.floor(Date.now() / 1000); // timestamp up to second
  console.log(timestamp_now);

  const url =
    "https://maps.googleapis.com/maps/api/timezone/json?location=" +
    lat +
    "," +
    lng +
    "&timestamp=" +
    timestamp_now +
    "&key=" +
    googleTimezonApiKey;

  fetch(url).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        const systemTime = new Date(timestamp_now * 1000);
        console.log(systemTime);
        console.log(data.timeZoneId);

        const locationTimeFormatter = new Intl.DateTimeFormat(undefined, {
          timeZone: data.timeZoneId,
          weekday: "short",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        });

        $("<div>").text("Location Time |\u00A0").appendTo($(".timeBox"));
        $("<div>")
          .addClass("locationTime d-inline fadeIn ")
          .text(locationTimeFormatter.format(systemTime))
          .appendTo($(".timeBox"));
      });
    }
  });
}

function getForecast(lat, lng, unit) {
  let url =
    "https://api.openweathermap.org/data/3.0/onecall?lat=" +
    lat +
    "&lon=" +
    lng +
    "&exclude=current,minutely,hourly,alerts&appid=" +
    weatherApiKey +
    "&units=" +
    unit;

  fetch(url).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let forecastDatas = data.daily;
        console.log("forecast data: ", forecastDatas);
      });
    }
  });
}

function clearResults() {
  const results = document.getElementById("cardList");
  while (results.childNodes[0]) {
    results.removeChild(results.childNodes[0]);
  }
}
