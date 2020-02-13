Module.register("MMM-forecast-io", {

  defaults: {
    apiKey: "",
    apiBase: "https://api.darksky.net/forecast",
    units: config.units,
    language: config.language,
    showIndoorTemperature: false,
    updateInterval: 5 * 60 * 1000, // every 5 minutes
    animationSpeed: 1000,
    initialLoadDelay: 0, // 0 seconds delay
    retryDelay: 2500,
    tempDecimalPlaces: 0, // round temperatures to this many decimal places
    geoLocationOptions: {
      enableHighAccuracy: true,
      timeout: 5000
    },
    latitude:  null,
    longitude: null,
    showForecast: true,
    forecastTableFontSize: 'medium',
    maxDaysForecast: 7,   // maximum number of days to show in forecast
    fcBarOffset: 20,
    showSunriseSunset: true,
    enablePrecipitationGraph: true,
    alwaysShowPrecipitationGraph: false,
    precipitationGraphWidth: 400,
    precipitationFillColor: 'white',
    precipitationProbabilityThreshold: 0,
    precipitationIntensityScaleTop: 0.2,
    unitTable: {
      'default':  'auto',
      'metric':   'si',
      'imperial': 'us'
    },
    iconTable: {
      'clear-day':           'wi-day-sunny',
      'clear-night':         'wi-night-clear',
      'rain':                'wi-rain',
      'snow':                'wi-snow',
      'sleet':               'wi-rain-mix',
      'wind':                'wi-cloudy-gusts',
      'fog':                 'wi-fog',
      'cloudy':              'wi-cloudy',
      'partly-cloudy-day':   'wi-day-cloudy',
      'partly-cloudy-night': 'wi-night-cloudy',
      'hail':                'wi-hail',
      'thunderstorm':        'wi-thunderstorm',
      'tornado':             'wi-tornado'
    },
    debug: false
  },

  getTranslations: function () {
    return false;
  },

  getScripts: function () {
    return [
      'jsonp.js',
      'moment.js',
      this.file('node_modules/chart.js/dist/Chart.bundle.js')
    ];
  },

  getStyles: function () {
    return ["weather-icons.css", "MMM-forecast-io.css"];
  },

  shouldLookupGeolocation: function () {
    return this.config.latitude == null &&
           this.config.longitude == null;
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    moment.locale(config.language);

    // still accept the old config
    if (this.config.hasOwnProperty("showPrecipitationGraph")) {
      this.config.enablePrecipitationGraph = this.config.showPrecipitationGraph;
    }

    if (this.shouldLookupGeolocation()) {
      this.getLocation();
    }
    this.scheduleUpdate(this.config.initialLoadDelay);
  },

  updateWeather: function () {
    if (this.geoLocationLookupFailed) {
      return;
    }
    if (this.shouldLookupGeolocation() && !this.geoLocationLookupSuccess) {
      this.scheduleUpdate(1000); // try again in one second
      return;
    }

    var units = this.config.unitTable[this.config.units] || 'auto';

    var url = this.config.apiBase + '/' + this.config.apiKey + '/' + this.config.latitude + ',' + this.config.longitude + '?units=' + units + '&lang=' + this.config.language;
    if (this.config.data) {
      // for debugging
      this.processWeather(this.config.data);
    } else {
      getJSONP(url, this.processWeather.bind(this), this.processWeatherError.bind(this));
    }
  },

  processWeather: function (data) {
    if (this.config.debug) {
      console.log('weather data', data);
    }
    this.loaded = true;
    this.weatherData = data;
    this.temp = this.roundTemp(this.weatherData.currently.temperature);
    this.updateDom(this.config.animationSpeed);
    this.scheduleUpdate();
  },

  processWeatherError: function (error) {
    if (this.config.debug) {
      console.log('process weather error', error);
    }
    // try later
    this.scheduleUpdate();
  },

  notificationReceived: function(notification, payload, sender) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
        break;
      case "INDOOR_TEMPERATURE":
        if (this.config.showIndoorTemperature) {
          this.roomTemperature = payload;
          this.updateDom(this.config.animationSpeed);
        }
        break;
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div");

    if (this.config.apiKey === "") {
      wrapper.innerHTML = "Please set the correct forcast.io <i>apiKey</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (this.geoLocationLookupFailed) {
      wrapper.innerHTML = "Geolocation lookup failed, please set <i>latitude</i> and <i>longitude</i> in the config for module: " + this.name + ".";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate('LOADING');
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    var currentWeather = this.weatherData.currently;
    var daily          = this.weatherData.daily;
    var hourly         = this.weatherData.hourly;
    var minutely       = this.weatherData.minutely;

    var large = document.createElement("div");
    large.className = "large light";

    var icon = currentWeather ? currentWeather.icon : hourly.icon;
    var iconClass = this.config.iconTable[icon];
    var iconSpan = document.createElement("span");
    iconSpan.className = 'big-icon wi ' + iconClass;
    large.appendChild(iconSpan);

    var temperature = document.createElement("span");
    temperature.className = "bright";
    temperature.innerHTML = " " + this.temp + "&deg;";
    large.appendChild(temperature);

    if (this.roomTemperature !== undefined) {
      var iconRT = document.createElement("span");
      iconRT.className = 'fa fa-home';
      large.appendChild(iconRT);

      var temperatureRT = document.createElement("span");
      temperatureRT.className = "bright";
      temperatureRT.innerHTML = " " + this.roomTemperature + "&deg;";
      large.appendChild(temperatureRT);
    }

    var sunriseSunset = document.createElement("div");
    sunriseSunset.className = "small dimmed extras";
    var sunriseIcon = document.createElement("span");
    sunriseIcon.className = "wi wi-sunrise";
    sunriseSunset.appendChild(sunriseIcon);
    var sunriseTime = document.createElement("span");
    sunriseTime.innerHTML = moment(new Date(daily.data[0].sunriseTime * 1000)).format("LT") + "&nbsp;";
    sunriseSunset.appendChild(sunriseTime);
    var sunsetIcon = document.createElement("span");
    sunsetIcon.className = "wi wi-sunset";
    sunriseSunset.appendChild(sunsetIcon);
    var sunsetTime = document.createElement("span");
    sunsetTime.innerHTML = moment(new Date(daily.data[0].sunsetTime * 1000)).format("LT");
    sunriseSunset.appendChild(sunsetTime);


    var summaryText = minutely ? minutely.summary : hourly.summary;
    var summary = document.createElement("div");
    summary.className = "small dimmed summary";
    summary.innerHTML = summaryText;

    wrapper.appendChild(large);
    wrapper.appendChild(summary);

    if (this.config.showSunriseSunset) {
      wrapper.appendChild(sunriseSunset);
    }

    var cc = document.createElement("div");
    cc.className = "canvasContainer";
    cc.width = this.config.precipitationGraphWidth;
    cc.height = Math.floor(cc.width * 0.5);

    if (this.config.alwaysShowPrecipitationGraph ||
        (this.config.enablePrecipitationGraph &&
         this.isAnyPrecipitation(minutely,hourly))) {
      cc.appendChild(this.renderCloudBars(minutely?this.weatherData.minutely.data:this.weatherData.hourly.data));
      //cc.appendChild(this.renderBackground(minutely?this.weatherData.minutely.data:this.weatherData.hourly.data));
      cc.appendChild(this.renderPrecipitationGraph(minutely?this.weatherData.minutely.data:this.weatherData.hourly.data));
      wrapper.appendChild(cc);
    }

    if (this.config.showForecast) {
      wrapper.appendChild(this.renderWeatherForecast());
    }

    return wrapper;
  },


  isAnyPrecipitation: function (minutely,hourly) {
    if (!minutely&&!hourly) {
      return false;
    }
    var data = this.weatherData.hourly.data;
    var threshold = this.config.precipitationProbabilityThreshold;
    for (i = 0; i < data.length; i++) {
      if (data[i].precipProbability > threshold) {
        return true;
      }
    }
    return false;
  },


  renderCloudBars: function(data) {
    var barCanvas = document.createElement('canvas');
    barCanvas.className = "cloudBarGraph";
    barCanvas.width  = this.config.precipitationGraphWidth;
    barCanvas.height = Math.floor(barCanvas.width * 0.5);
    barCanvas.style.display = "block";
    var barContext = barCanvas.getContext('2d');
    var clouds = [], sun = [], times = [], cloudColors = [], sunColors = [], times = [];
    for (var i = 0; i < data.length; i++) {
      clouds.push(data[i].cloudCover);
      sun.push(1 - data[i].cloudCover);
      if (moment(data[i].time * 1000).hour() == 11) {
        times[i] = moment(data[i].time * 1000).format('dd');
      } else {
        times[i] = "";
      }
      //console.log("Times: "+times);
      var sunriseHour = moment(this.weatherData.daily.data[0].sunriseTime, "X").hours();
      var sunsetHour = moment(this.weatherData.daily.data[0].sunsetTime, "X").hours();
      var currentHour = moment(data[i].time, "X").hours();
      if ((currentHour < sunsetHour) && (currentHour > sunriseHour)) {
        cloudColors.push('#d8dddf');
        sunColors.push('#ffe54c')
      } else {
        cloudColors.push('#232323');
        sunColors.push('#546bab')
      }
    }

    Chart.defaults.global.defaultFontSize = 12;

    var cloudBars = new Chart(barContext, {
      type: 'bar',
        data: {
          labels: times,
          datasets: [
            {
              label: "clouds",
              data: clouds,
              backgroundColor: cloudColors,
            },
            {
              label: "sun",
              data: sun,
              backgroundColor: sunColors,
            }
          ],
        },
        options: {
          maintainAspectRatio: false,
          responsive: false,
          scales: {
            yAxes: [{
              stacked: true,
              display: false,
            }],
            xAxes: [{
              stacked: true,
              //display: false,
              barPercentage: 1,
              categoryPercentage: 0.9,
              ticks: {
                //display: false,
                fontColor: '#DDD',
                fontSize: 18,
                source: 'auto',
                maxRotation: 0,
                minRotation: 0,
                mirror: true,
              },
            }]
          },
          legend: { display: false },
          layout: {
            padding: 0,
          },
          cubicInterpolationMode: "default",
        }
      });
    return barCanvas;
  },


  /*renderBackground: function(data) {    // ======= shade blocks for daylight hours
    var i;
    var width = this.config.precipitationGraphWidth;
    var height = Math.round(width * 0.4) + 100;
    var bgCanvas = document.createElement('canvas');
    bgCanvas.className = "precipitation-bg";
    bgCanvas.width  = width;
    bgCanvas.height = height;
    bgCanvas.style.display = "block";

    var bgContext = bgCanvas.getContext('2d');

    var now = new Date();
    now = Math.floor(now / 1000);    // current time in Unix format


    var stepSize = Math.round(width / data.length);

    var timeUntilSunrise;
    var timeUntilSunset;
    var sunrisePixels;    // daytime shade box location on graph
    var sunsetPixels;
    bgContext.fillStyle = "#767676";

    for (i = 0; i < 3; i++) {                // 3 days ([0]..[2])
      timeUntilSunrise = (this.weatherData.daily.data[i].sunriseTime - now);
      timeUntilSunset  = (this.weatherData.daily.data[i].sunsetTime - now);

      if ((timeUntilSunrise < 0) && (i == 0)) {
        timeUntilSunrise = 0;       // sunrise has happened already today
      }
      if ((timeUntilSunset < 0) && (i == 0)) {
        timeUntilSunset = 0;        // sunset has happened already today
      }

      sunrisePixels = (timeUntilSunrise/60/60)*stepSize;
      sunsetPixels  = (timeUntilSunset/60/60)*stepSize;
      bgContext.fillRect(sunrisePixels, 1, (sunsetPixels-sunrisePixels), height-35);
      bgContext.strokeRect(0, 0, width, height);
    }

    bgContext.beginPath();
    bgContext.lineWidth = "3";
    bgContext.strokeStyle = "#bababa";
    bgContext.rect(1, 1, width-3, height-33);
    bgContext.stroke();

    return bgCanvas;
  },*/

  renderPrecipitationGraph: function (data) {
    moment.locale(this.config.language);
    var i;
    var width = this.config.precipitationGraphWidth;
    var height = Math.round(width * 0.5);
    var graph = document.createElement('canvas');
    graph.className = "precipitation-graph";
    graph.width  = width;
    graph.height = height;
    graph.style.display = "block";

    var context = graph.getContext('2d');

    var threshold = this.config.precipitationProbabilityThreshold;
    var intensity = [];
    var times = [];


    for (i = 0; i < data.length; i++) {
      if (data[i].precipProbability < threshold) {
        intensity[i] = 0;
      } else {
        intensity[i] = data[i].precipIntensity;
      }
      if (moment(data[i].time * 1000).hour() == 11) {
        times[i] = moment(data[i].time * 1000).format('dd');
      } else {
        times[i] = "";
      }
    }
    console.log("Times: "+times);
    //console.log("Rendering graph with: " + intensity + ", " + times);

    Chart.defaults.global.defaultFontSize = 12;

    var rainChart = new Chart(context, {
      type: 'bar',
        data: {
          labels: times,
          datasets: [{
            label: "rain",
            data: intensity,
            backgroundColor: '#0066ff',
            pointRadius: 0,
          }],
        },
        options: {
          maintainAspectRatio: false,
          responsive: false,
          scales: {
            gridLines: {
              display: true,
            },
            yAxes: [{
              display: false,
              ticks: {
                suggestedMax: 1.5,
              }
            }],
            xAxes: [{
              barPercentage: 1,
              categoryPercentage: 1,
              ticks: {
                fontColor: '#DDD',
                fontSize: 18,
                source: 'auto',
                maxRotation: 0,
                minRotation: 0,
                mirror: true,
              },
            }]
          },
          legend: { display: false },
          layout: {
            padding: 0,
          },
          cubicInterpolationMode: "default",
        }
      });
    return graph;
  },

  getDayFromTime: function (time) {
    var dt = new Date(time * 1000);
    return moment.weekdaysShort(dt.getDay());
  },

  renderForecastRow: function (data, min, max) {
    var total = max - min;
    var interval = 100 / total;
    var rowMinTemp = this.roundTemp(data.temperatureMin);
    var rowMaxTemp = this.roundTemp(data.temperatureMax);
    var rgbMin = [0,0,0];
    var rgbMax = [0,0,0];


    var row = document.createElement("tr");
    row.className = "forecast-row";

    var dayTextSpan = document.createElement("span");
    dayTextSpan.className = "forecast-day";
    dayTextSpan.innerHTML = this.getDayFromTime(data.time);
    var iconClass = this.config.iconTable[data.icon];
    var icon = document.createElement("span");
    icon.className = 'wi weathericon ' + iconClass;

    var dayPrecipProb = document.createElement("span");
    dayPrecipProb.className = "forecast-precip-prob";
    dayPrecipProb.innerHTML = (Math.round(data.precipIntensity *10 * 24))/10 + "";

    var forecastBar = document.createElement("div");
    forecastBar.className = "forecast-bar";

    var minTemp = document.createElement("span");
    minTemp.innerHTML = rowMinTemp + "&deg;";
    minTemp.className = "temp min-temp";

    var maxTemp = document.createElement("span");
    maxTemp.innerHTML = rowMaxTemp + "&deg;";
    maxTemp.className = "temp max-temp";

    var bar = document.createElement("span");
    bar.className = "bar";
    bar.innerHTML = "&nbsp;";
    var barWidth = Math.round(interval * (rowMaxTemp - rowMinTemp));
    bar.style.width = barWidth + '%';

    var leftSpacer = document.createElement("span");
    leftSpacer.style.width = (interval * (rowMinTemp - min)) + "%";
    var rightSpacer = document.createElement("span");
    rightSpacer.style.width = (interval * (max - rowMaxTemp)) + "%";

    forecastBar.appendChild(leftSpacer);
    forecastBar.appendChild(minTemp);
    forecastBar.appendChild(bar);
    forecastBar.appendChild(maxTemp);
    forecastBar.appendChild(rightSpacer);

    var forecastBarWrapper = document.createElement("td");
    forecastBarWrapper.appendChild(forecastBar);

    var fbWidth = forecastBar.width;
    var bgSize = ((250 / (10 * total)) * 650);       //forecast bar max width assumed to be 250. 65 Degrees Celsius span for background picture (-20°C to +45°C)
    bar.style.backgroundSize = bgSize + "px auto";
    var bgOffset = -(bgSize * ((rowMinTemp + 20) / 65)) - this.config.fcBarOffset; //move background picture on color scale.
    bar.style.backgroundPosition = bgOffset + "px 0px";

    row.appendChild(dayTextSpan);
    row.appendChild(icon);
    row.appendChild(dayPrecipProb);
    row.appendChild(forecastBarWrapper);

    return row;
  },

  renderWeatherForecast: function () {
    var numDays =  this.config.maxDaysForecast;
    var i;

    var filteredDays =
      this.weatherData.daily.data.filter( function(d, i) { return (i < numDays); });

    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      min = Math.min(min, day.temperatureMin);
      max = Math.max(max, day.temperatureMax);
    }
    min = Math.round(min);
    max = Math.round(max);

    var display = document.createElement("table");
    display.className = this.config.forecastTableFontSize + " forecast";
    for (i = 0; i < filteredDays.length; i++) {
      var day = filteredDays[i];
      var row = this.renderForecastRow(day, min, max);
      display.appendChild(row);
    }
    return display;
  },

  getLocation: function () {
    var self = this;
    navigator.geolocation.getCurrentPosition(
      function (location) {
        if (self.config.debug) {
          console.log("geolocation success", location);
        }
        self.config.latitude  = location.coords.latitude;
        self.config.longitude = location.coords.longitude;
        self.geoLocationLookupSuccess = true;
      },
      function (error) {
        if (self.config.debug) {
          console.log("geolocation error", error);
        }
        self.geoLocationLookupFailed = true;
        self.updateDom(self.config.animationSpeed);
      },
      this.config.geoLocationOptions);
  },

// Round the temperature based on tempDecimalPlaces
  roundTemp: function (temp) {
    var scalar = 1 << this.config.tempDecimalPlaces;

    temp *= scalar;
    temp  = Math.round( temp );
    temp /= scalar;

    return temp;
  },

  scheduleUpdate: function(delay) {
    var nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    var self = this;
    setTimeout(function() {
      self.updateWeather();
    }, nextLoad);
  }

});
