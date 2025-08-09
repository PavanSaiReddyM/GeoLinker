const socket = io();

let map;
let myMarker;
const markers = {};
const fixedPaths = {}; 
let routeToUserControl = null; 

let myLatLng = null;
let myUsername = null;

let users = {}; 

document.getElementById("joinBtn").addEventListener("click", () => {
  const usernameInput = document.getElementById("usernameInput");
  myUsername = usernameInput.value.trim() || "Anonymous";

  if (!myUsername) {
    alert("Please enter a username");
    return;
  }

  socket.emit("join", myUsername);

  usernameInput.disabled = true;
  document.getElementById("joinBtn").disabled = true;


  document.getElementById("placeholder").style.display = "none";
  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  initMapAndTrack();
});


function initMapAndTrack() {
  map = L.map("map").setView([20.5937, 78.9629], 5); 

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Map data © OpenStreetMap contributors",
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        myLatLng = [latitude, longitude];

       
        socket.emit("send-location", { latitude, longitude });

        if (!myMarker) {
          myMarker = L.marker(myLatLng)
            .addTo(map)
            .bindPopup(`You are here (${myUsername})`)
            .openPopup();
        } else {
          myMarker.setLatLng(myLatLng);
          myMarker.setPopupContent(`You are here (${myUsername})`);
        }

        map.setView(myLatLng, 13);
      },
      (err) => {
        console.error("Geolocation error:", err.message);
        alert("Please enable location for full experience. Showing static demo data.");

     
        fallbackStaticSetup();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    alert("Geolocation not supported. Showing static demo data.");
    fallbackStaticSetup();
  }
}

function fallbackStaticSetup() {
  myLatLng = [28.6139, 77.2090];

  if (!myMarker) {
    myMarker = L.marker(myLatLng)
      .addTo(map)
      .bindPopup(`You are here (${myUsername || "Me"})`)
      .openPopup();
  }

  map.setView(myLatLng, 13);

  
}


socket.on("user-list", (newUsers) => {
  users = newUsers; 

  updateSidebar();
  updateMarkersAndPaths();
});


function updateMarkersAndPaths() {
 
  Object.keys(markers).forEach((id) => {
    if (!users[id]) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });
  Object.keys(fixedPaths).forEach((id) => {
    if (!users[id]) {
      map.removeControl(fixedPaths[id]);
      delete fixedPaths[id];
    }
  });

  
  Object.entries(users).forEach(([id, user]) => {
    
    const userLatLng = user.location
      ? [user.location.latitude, user.location.longitude]
      : user.path && user.path.length
      ? [user.path[user.path.length - 1].latitude, user.path[user.path.length - 1].longitude]
      : null;

    if (!userLatLng) return;

   
    if (!markers[id]) {
      markers[id] = L.marker(userLatLng).addTo(map).bindPopup(user.username);
    } else {
      markers[id].setLatLng(userLatLng);
      markers[id].getPopup().setContent(user.username);
    }

   
    if (user.path && user.path.length >= 2) {
      drawFixedPath(id, user.path);
    }
  });
}

function drawFixedPath(id, waypoints) {
  if (fixedPaths[id]) {
    map.removeControl(fixedPaths[id]);
    delete fixedPaths[id];
  }

  if (waypoints.length < 2) return;

  const latLngs = waypoints.map((p) => L.latLng(p.latitude, p.longitude));

  fixedPaths[id] = L.Routing.control({
    waypoints: latLngs,
    routeWhileDragging: false,
    show: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: false,
    createMarker: () => null,
    lineOptions: {
      styles: [{ color: "green", opacity: 0.7, weight: 4 }],
    },
  }).addTo(map);
}

function updateSidebar() {
  const userListElement = document.getElementById("users");
  userListElement.innerHTML = "";

  Object.entries(users).forEach(([id, user]) => {
    const li = document.createElement("li");
    li.textContent = user.username || "Anonymous";
    li.style.cursor = "pointer";
    userListElement.appendChild(li);

    li.addEventListener("click", () => {
      drawRouteToUser(id);
    });
  });
}

function drawRouteToUser(id) {
  if (!myLatLng) {
    alert("Your location not determined yet.");
    return;
  }
  if (!users[id]) return;

  const user = users[id];
  
  const userLatLng = user.location
    ? L.latLng(user.location.latitude, user.location.longitude)
    : user.path && user.path.length
    ? L.latLng(user.path[user.path.length - 1].latitude, user.path[user.path.length - 1].longitude)
    : null;

  if (!userLatLng) return;

  if (routeToUserControl) {
    map.removeControl(routeToUserControl);
    routeToUserControl = null;
  }

  routeToUserControl = L.Routing.control({
    waypoints: [L.latLng(myLatLng), userLatLng],
    routeWhileDragging: false,
    show: true,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    lineOptions: {
      styles: [{ color: "blue", opacity: 0.8, weight: 5 }],
    },
    createMarker: (i, wp) => {
      if (i === 0) {
        return L.marker(wp.latLng).bindPopup("You are here").openPopup();
      } else {
        return L.marker(wp.latLng).bindPopup(user.username).openPopup();
      }
    },
  }).addTo(map);
}
