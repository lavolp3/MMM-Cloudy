Module.register("MMM-Cloudy", {

    defaults: {
        apiKey: "",
        units: config.units,
        language: config.language,
        updateInterval: 5 * 60 * 1000, // every 5 minutes
        animationSpeed: 1000,
        initialLoadDelay: 0, // 0 seconds delay
        tempDecimals: 0, // round temperatures to this many decimal places
        geoLocationOptions: {
            enableHighAccuracy: true,
            timeout: 5000
        },
        latitude:  null,
        longitude: null,
        showSummary: false,
        showForecast: true,
        forecastTableFontSize: 'medium',
        maxForecastHours: 100,
        maxForecastDays: 7,   // maximum number of days to show in forecast
        fcBarOffset: 20,
        showSunriseSunset: true,
        showCloudChart: true,
        alwaysshowCloudChart: false,
        cloudChartWidth: 400,
        precipitationProbabilityThreshold: 0,
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
        debug: false,
    },

    getTranslations: function () {
        return false;
    },

    getScripts: function () {
        return [
            'jsonp.js',
            this.file('node_modules/chart.js/dist/Chart.bundle.js')
        ];
    },

    getStyles: function () {
        return ["weather-icons.css", "MMM-Cloudy.css"];
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        moment.locale(config.language);
        this.loaded = false;
        this.scheduleUpdate(this.config.initialLoadDelay);
    },
  
  
    socketNotificationReceived: function(notification, payload) {
        console.log("Socket Notification received: " + notification);
        // was not able to receive data
        if (notification == "ERROR") {
            this.scheduleUpdate();
            this.apiError = true;
            //this.updateDom();
        } else if (notification == "WEATHER_DATA") {
            this.log(payload);
            this.processWeather(payload);
            this.apiError = false;
        }
    },


    updateWeather: function () {
        this.log("Updating Weather Data...");
        this.sendSocketNotification('WEATHER_REQUEST', this.config);
    },

    processWeather: function (data) {
        this.log('weather data:', data);
        this.loaded = true;
        this.weatherData = data;
        this.temp = this.weatherData.hourly.temperature_2m[0].toFixed(this.config.tempDecimals);
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
        }
    },

    getDom: function() {
        var wrapper = document.createElement("div");

        /*if (this.config.apiKey === "") {
            wrapper.innerHTML = "Please set the correct OpenWeatherMarp.org <i>apiKey</i> in the config for module: " + this.name + ".";
            wrapper.className = "dimmed light small";
            return wrapper;
        }*/

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

        //var currentWeather = this.weatherData.current;
        var daily  = this.weatherData.daily;
        var hourly = this.weatherData.hourly;
        //var minutely       = this.weatherData.minutely;
        this.startLoop = hourly.time.findIndex(element => moment().format("x") < moment(element).format("x")) -1;
        this.log("Startloop: " + this.startLoop);
    

        /*var icon = currentWeather ? currentWeather.icon : hourly.icon;
        var iconClass = this.config.iconTable[icon];
        var iconSpan = document.createElement("span");
        iconSpan.className = 'big-icon wi ' + iconClass;
        large.appendChild(iconSpan);
        */
    
        
        var sunriseSunset = document.createElement("div");
        sunriseSunset.className = "small dimmed extras";
        var sunriseIcon = document.createElement("span");
        sunriseIcon.className = "wi wi-sunrise";
        sunriseSunset.appendChild(sunriseIcon);
        var sunriseTime = document.createElement("span");
        sunriseTime.innerHTML = moment(daily.sunrise[0]).format("LT") + "&nbsp;";
        sunriseSunset.appendChild(sunriseTime);
        var sunsetIcon = document.createElement("span");
        sunsetIcon.className = "wi wi-sunset";
        sunriseSunset.appendChild(sunsetIcon);
        var sunsetTime = document.createElement("span");
        sunsetTime.innerHTML = moment(daily.sunset[0]).format("LT");
        sunriseSunset.appendChild(sunsetTime);


        var summaryText = "No summary yet!" //currentWeather.weather[0].description;
        var summary = document.createElement("div");
        summary.className = "small dimmed summary";
        summary.innerHTML = summaryText;

        if (this.config.showSummary) wrapper.appendChild(summary);


        if (this.config.showSunriseSunset) {
            wrapper.appendChild(sunriseSunset);
        }

        var apiAlert = document.createElement("span");
        apiAlert.className = "bright light medium fas fa-triangle-exclamation";
        if (this.error) wrapper.appendChild(apiAlert);

        var cc = document.createElement("div");
        cc.className = "canvasContainer";
        cc.width = this.config.cloudChartWidth;
        cc.height = Math.floor(cc.width * 0.5);

        if (this.config.alwaysshowCloudChart || (this.config.showCloudChart && this.isAnyPrecipitation(minutely,hourly))) {
            cc.appendChild(this.renderCloudBars(this.weatherData.hourly));
            cc.appendChild(this.renderPrecipitationGraph(this.weatherData.hourly));
            wrapper.appendChild(cc);
        }

        if (this.config.showForecast) {
            wrapper.appendChild(this.renderWeatherForecast(this.weatherData.daily));
        }

        return wrapper;
    },


    isAnyPrecipitation: function (minutely,hourly) {
        if (!minutely&&!hourly) {
          return false;
        }
        var data = this.weatherData.hourly.precipitation_probability;
        var threshold = this.config.precipitationProbabilityThreshold;
        for (i = 0; i < this.config.maxForecastHours; i++) {
            if (data[i] > threshold) {
                return true;
            }
        }
        return false;
    },


    renderCloudBars: function(data) {
        var barCanvas = document.createElement('canvas');
        barCanvas.className = "cloudBarGraph";
        barCanvas.width  = this.config.cloudChartWidth;
        barCanvas.height = Math.floor(barCanvas.width * 0.5);
        barCanvas.style.display = "block";
        var barContext = barCanvas.getContext('2d');
        var barData = {
            clouds:[], 
            sun: [], 
            times: [], 
            cloudColors: [], 
            sunColors: []
        };
        var cloudCoverData = data.cloudcover;
        for (var i = this.startLoop; i < this.config.maxForecastHours; i++) {
            barData.clouds.push(cloudCoverData[i]/100);
            barData.sun.push(1 - cloudCoverData[i]/100);
            if (moment(data.time[i]).hour() == 11) {
                barData.times.push(moment(data.time[i]).format('dd'));
            } else {
                barData.times.push(" ");
            }
            /*var sunriseHour = moment(this.weatherData.daily[0].sunrise, "X").hours();
            var sunsetHour = moment(this.weatherData.daily[0].sunset, "X").hours();
            var currentHour = moment(data[i].dt, "X").hours();*/
            if (data.is_day[i] == 1) {//((currentHour < sunsetHour) && (currentHour > sunriseHour)) {
                barData.cloudColors.push('#d8dddf');
                barData.sunColors.push('#ffe54c')
            } else {
                barData.cloudColors.push('#232323');
                barData.sunColors.push('#546bab')
            }
        };
    
        this.log(barData);

        Chart.defaults.global.defaultFontSize = 12;

        var cloudBars = new Chart(barContext, {
            type: 'bar',
            data: {
                labels: barData.times,
                datasets: [
                {
                    label: "clouds",
                    data: barData.clouds,
                    barPercentage: 1,
                    categoryPercentage: 0.9,
                    backgroundColor: barData.cloudColors,
                },
                {
                    label: "sun",
                    data: barData.sun,
                    barPercentage: 1,
                    categoryPercentage: 0.9,
                    backgroundColor: barData.sunColors,
                }],
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

    renderPrecipitationGraph: function (data) {
        moment.locale(this.config.language);
        var i;
        var width = this.config.cloudChartWidth;
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

        var rainData = data.precipitation;
        for (i = this.startLoop; i < this.config.maxForecastHours; i++) {
            /*if (rainData[i].pop < threshold) {
                intensity[i] = 0;
            } else {*/
            intensity.push(rainData[i]);
            //}
            if (moment(data.time[i]).hour() == 11) {
                times.push(moment(data.time[i]).format('dd'));
            } else {
                times.push("");
            }
        }
        this.log("Times: " + times);
        this.log("Rendering graph with: " + intensity + ", " + times);
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
                dataset: {
                    barPercentage: 1,
                    categoryPercentage: 1,
                },
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

    renderForecastRow: function (data, i, min, max) {
        var total = max - min;
        var interval = 100 / total;
        var rowMinTemp = Math.round(data.temperature_2m_min[i]) //.toFixed(this.config.tempDecimals);
        var rowMaxTemp = Math.round(data.temperature_2m_max[i]) //.toFixed(this.config.tempDecimals);

        var row = document.createElement("tr");
        row.className = "forecast-row";

        var dayTextSpan = document.createElement("span");
        dayTextSpan.className = "forecast-day";
        dayTextSpan.innerHTML = moment(data.time[i]).format("dd");
        var iconClass = this.config.iconTable[''];               //DATA MISSING!
        var icon = document.createElement("span");
        icon.className = 'wi weathericon ' + iconClass;

        var dayPrecipProb = document.createElement("span");
        dayPrecipProb.className = "forecast-precip-prob";
        dayPrecipProb.innerHTML = data.precipitation_sum[i];

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
        var bgSize = (250 / total * 65);       //forecast bar max width assumed to be 250. 65 Degrees Celsius span for background picture (-20°C to +45°C)
        bar.style.backgroundSize = bgSize + "px auto";
        var bgOffset = -(bgSize * ((rowMinTemp + 20) / 65)) - this.config.fcBarOffset; //move background picture on color scale.
        bar.style.backgroundPosition = bgOffset + "px 0px";

        row.appendChild(dayTextSpan);
        row.appendChild(icon);
        row.appendChild(dayPrecipProb);
        row.appendChild(forecastBarWrapper);

        return row;
    },

    renderWeatherForecast: function (data) {
        var numDays =  this.config.maxForecastDays;
        var i;

        /*var filteredDays =
          this.weatherData.daily.time.filter( function(d, i) { return (i < numDays); });

        for (i = 0; i < data.time.length; i++) {
          var day = data.time[i];
          min = Math.min(min, day.temperatureMin);
          max = Math.max(max, day.temperatureMax);
        }
        min = Math.round(min);
        max = Math.round(max);
        */
        var min = Math.min(...data.temperature_2m_min);
        var max = Math.max(...data.temperature_2m_max);
        this.log("Minmax temps: " + min + ", " + max);
    
        var display = document.createElement("table");
        display.className = this.config.forecastTableFontSize + " forecast";
        for (i = 0; i < data.time.length; i++) {
            var row = this.renderForecastRow(data, i, min, max);
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

    scheduleUpdate: function(delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }
        var self = this;
        setTimeout(function() {
            self.updateWeather();
        }, nextLoad);
    },
  
    log: function (msg) {
        if (this.config && this.config.debug) {
            console.log(this.name + ": ", (msg));
        }
    }
});
