var NodeHelper = require('node_helper');
var axios = require('axios');
var moment = require('moment');

module.exports = NodeHelper.create({

    // Override start method.
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.weatherData = {};
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(notification, payload) {
        this.log("Socket Notification received. Title: "+notification+", Payload: "+payload);
        if (notification == "WEATHER_REQUEST") {
            this.config = payload;
            this.getData();
        }
    },

    getData: function() {
        var self = this;
        /*var url = 'https://data.climacell.co/v4/timelines?location=' 
        + this.config.latitude + ',' 
        + this.config.longitude
        + '&fields=precipitationIntensity,precipitationType,humidity,temperature,temperatureApparent,'
        + 'cloudCover,precipitationProbability,visibility,weatherCode,windDirection,windSpeed,windGust'
        + '&timesteps=1h'
        + '&apikey=' + this.config.apiKey;*/
        var url = "https://api.open-meteo.com/v1/forecast?latitude=51.45&longitude=6.63&hourly=temperature_2m,dewpoint_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,cloudcover,windspeed_10m,winddirection_10m,windgusts_10m,temperature_80m,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=Europe%2FBerlin"
        this.log("Calling URL: "+url);
        axios.get(url)
        .then(function (response, body) {
            self.log(response.data);
            self.sendSocketNotification('WEATHER_DATA', response.data)
        })
        .catch(function (error) {
            console.error(error);
            self.sendSocketNotification('ERROR', error);
        });
    },

    log: function (msg) {
        if (this.config && this.config.debug) {
            console.log(this.name + ": ", (msg));
        }
    }
});
