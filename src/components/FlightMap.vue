<template>
<ol-map ref="map" @click="handleClickDelete" :loadTilesWhileAnimating="true" :loadTilesWhileInteracting="true" style="height: 100%">
    <ol-view
      ref="view"
      :center="center"
      :rotation="rotation"
      :zoom="zoom"
      :projection="projection"
      @zoomChanged="zoomChanged"
      @centerChanged="centerChanged"
      @resolutionChanged="resolutionChanged"
      @rotationChanged="rotationChanged"
    />

    <ol-zoom-control className="zoom" />

    <!-- OSM -->
    <ol-tile-layer>
        <ol-source-osm />
    </ol-tile-layer>

    <!-- Render a plane in the future :tm: -->
    <!--
    <ol-vector-layer>
        <ol-source-vector>
            <ol-feature>
                <ol-geom-point :coordinates="planeCoordinates"></ol-geom-point>
                <ol-style>
                    <ol-style-circle :radius="4">
                        <ol-style-fill color="red"></ol-style-fill>
                        <ol-style-stroke color="blue" :width="8"></ol-style-stroke>
                    </ol-style-circle>
                </ol-style>
            </ol-feature>
        </ol-source-vector>
    </ol-vector-layer>
    -->

    <!-- R -->
    <!--
    <ol-vector-layer>
        <ol-source-vector :features="features.filter(f => f.getProperties().type === 'restricted')">
        </ol-source-vector>
        <ol-style>
            <ol-style-stroke color="red" :width="2"></ol-style-stroke>
            <ol-style-fill color="rgba(255,125,125,0.7)"></ol-style-fill>
        </ol-style>
    </ol-vector-layer>
    -->

    <!-- Drawing -->
    <ol-vector-layer>
        <ol-source-vector :projection="projection" :features="selectedFeatures.array_">
            <ol-interaction-draw v-if="drawEnable" :type="drawType" @drawend="drawend"></ol-interaction-draw>
            <ol-interaction-modify v-if="modifyEnable" :features="selectedFeatures" @modifyend="modifyend"></ol-interaction-modify>
        </ol-source-vector>
        <ol-style>
            <ol-style-stroke color="red" :width="4" lineJoin="round" lineCap="butt" :lineDash="[15, 4]"></ol-style-stroke>
            <ol-style-fill color="rgba(255,255,255,0.1)"></ol-style-fill>
            <ol-style-circle :radius="7">
                <ol-style-fill color="blue"></ol-style-fill>
            </ol-style-circle>
        </ol-style>
    </ol-vector-layer>

    <!-- Flight tiles -->
    <ol-tile-layer v-if="showFlightOverlay">
      <ol-source-xyz :url="flightTiles" />
    </ol-tile-layer>

    <!-- Intersects -->
    <ol-vector-layer>
        <ol-source-vector>
            <ol-feature v-for="(intersect) in intersects" :key="intersect.values_.id">
                <ol-geom-point :coordinates="intersect.values_.intersect.geometry.coordinates"></ol-geom-point>
                <ol-style>
                    <ol-style-circle :radius="10">
                        <ol-style-fill color="rgba(0,0,0,0)"></ol-style-fill>
                        <ol-style-stroke color="yellow" :width="2"></ol-style-stroke>
                    </ol-style-circle>
                    <ol-style-fill color="black" :width="1"></ol-style-fill>
                    <ol-style-stroke color="rgba(0,0,0,0)" :width="1"></ol-style-stroke>
                    <ol-style-text :text="'!\n\n' + intersect.values_.name" :offsetY="12" :rotation="intersect.values_.trueTrack * Math.PI / 180">
                      <ol-style-fill color="black" :width="4"></ol-style-fill>
                      <ol-style-stroke color="rgba(0,0,0,0.2)" :width="1"></ol-style-stroke>
                    </ol-style-text>
                </ol-style>
            </ol-feature>
        </ol-source-vector>
    </ol-vector-layer>

    <!-- Five minute markers -->
    <ol-vector-layer v-if="fiveMinuteMarks.features.length > 0">
        <ol-source-vector>
            <ol-feature v-for="(feature, idx) in fiveMinuteMarks.features" :key="idx">
                <ol-geom-point :coordinates="proj4('EPSG:4326', 'EPSG:3857', feature.geometry.coordinates)"></ol-geom-point>
                <ol-style>
                    <ol-style-text :scale="2" text="|" :offsetY="-4" :offsetX="0" :rotation="(feature.properties.trueTrack + 90) * Math.PI/180" textAlign="left">
                      <ol-style-fill color="red" :width="15"></ol-style-fill>
                      <ol-style-stroke color="rgba(255,0,0,5)" :width="1"></ol-style-stroke>
                    </ol-style-text>
                </ol-style>
            </ol-feature>
        </ol-source-vector>
    </ol-vector-layer>

    <!-- Waypoints -->
    <ol-vector-layer v-if="journeyLegs.features.length > 0">
        <ol-source-vector>
            <ol-feature v-for="(feature, idx) in journeyLegs.features" :key="idx">
                <ol-geom-point :coordinates="proj4('EPSG:4326', 'EPSG:3857', feature.geometry.coordinates[0])"></ol-geom-point>
                <ol-style>
                    <ol-style-circle :radius="10">
                        <ol-style-fill color="rgba(0,0,0,0)"></ol-style-fill>
                        <ol-style-stroke color="yellow" :width="3"></ol-style-stroke>
                    </ol-style-circle>
                    <ol-style-text v-if="idx === 0" :scale="1.5" :text="feature.properties.text" :offsetY="-30" :offsetX="20" :rotation="feature.properties.trueTrack * Math.PI/180" textAlign="left">
                      <ol-style-fill color="black" :width="15"></ol-style-fill>
                      <ol-style-stroke color="rgba(255,255,255,0.5)" :width="5"></ol-style-stroke>
                    </ol-style-text>
                    <ol-style-text v-if="feature.properties.previousTrueTrack" :scale="1.5" :text="feature.properties.text" :offsetY="30" :offsetX="feature.properties.turnDirection === -1 ? 20 : -20" :rotation="feature.properties.previousTrueTrack * Math.PI/180" :textAlign="feature.properties.turnDirection === -1 ? 'left' : 'right'">
                      <ol-style-fill color="black" :width="1"></ol-style-fill>
                      <ol-style-stroke color="rgba(255,255,255,0.5)" :width="5"></ol-style-stroke>
                    </ol-style-text>
                </ol-style>
            </ol-feature>
        </ol-source-vector>
    </ol-vector-layer>

    <!-- Last waypoint -->
    <ol-vector-layer v-if="journeyLegs.features.length > 0">
        <ol-source-vector>
            <ol-feature v-for="(feature, idx) in journeyLegs.features" :key="idx">
                <ol-geom-point v-if="idx === journeyLegs.features.length - 1" :coordinates="proj4('EPSG:4326', 'EPSG:3857', journeyLegs.features.at(-1).geometry.coordinates[1])"></ol-geom-point>
                <ol-style>
                    <ol-style-text :scale="1.5" :text="feature.properties.textSecondPoi" :offsetY="20" :offsetX="10" :rotation="journeyLegs.features.at(-1).properties.trueTrack * Math.PI/180" textAlign="left">
                      <ol-style-fill color="black" :width="15"></ol-style-fill>
                      <ol-style-stroke color="rgba(255,255,255,0.5)" :width="5"></ol-style-stroke>
                    </ol-style-text>
                </ol-style>
            </ol-feature>
        </ol-source-vector>
    </ol-vector-layer>
</ol-map>

<div class="mapControls">
  <input id="showFlightOverlay" type="checkbox" v-model="showFlightOverlay">
  <label for="showFlightOverlay">Flyginfolager</label>
  <button @click="handleClickGetWeather">Hämta väder</button>
</div>

<div class="routePlan">
  <table id="routePlan">
    <tr>
      <th>Wind / vol</th>
      <th>Temp</th>
      <th>Altitude</th>
      <th>TAS</th>
      <th>TT</th>
      <th>wca</th>
      <th>TH</th>
      <th>var</th>
      <th>MH</th>
      <th>dev</th>
      <th>CH</th>
      <th>Desc</th>
      <th>D</th>
      <th>GS</th>
      <th>Time</th>
      <th>Acc. Time</th>
      <th>ETO</th>
      <th>Fuel</th>
      <th>Acc. Fuel</th>
    </tr>
    <tr v-for="(feature, idx) in journeyLegs.features" :key="feature">
      <td style="width: 30px; !important">
        <input :tabindex="(idx * 10) + 1" type="text" v-model="feature.properties.windDirection" @change="handleInputChange" />/
        <input :tabindex="(idx * 10) + 2" style="width: 20px;" type="text" v-model="feature.properties.windSpeed" @change="handleInputChange" />
      </td>
      <td><input class="char3" :tabindex="(idx * 10) + 3" type="text" v-model="feature.properties.temperature" @change="handleInputChange" />C</td>
      <td><input class="char4" :tabindex="(idx * 10) + 3" type="text" v-model="feature.properties.altitude" @change="handleInputChange" /> ft</td>
      <td><input class="char3" :tabindex="(idx * 10) + 4" type="text" v-model="feature.properties.TAS" @change="handleInputChange" /> kt</td>
      <td :title="feature.properties.trueTrack + '°'">{{ Math.round(feature.properties.trueTrack) }}°</td>
      <td>{{ Math.round(feature.properties.windCorrectionAngle) }}°</td>
      <td :title="feature.properties.trueHeading + '°'">{{ Math.round(feature.properties.trueHeading) }}°</td>
      <td><input class="char3" :tabindex="(idx * 10) + 5" type="text" v-model="feature.properties.variation" @change="handleInputChange" />°</td>
      <td :title="feature.properties.magneticHeading + '°'">{{ Math.round(feature.properties.magneticHeading) }}°</td>
      <td><input class="char3" :tabindex="(idx * 10) + 6" type="text" v-model="feature.properties.deviation" @change="handleInputChange" />°</td>
      <td :title="feature.properties.compassHeading + '°'">{{ Math.round(feature.properties.compassHeading) }}°</td>
      <td class="wide">{{ feature.properties.description }}</td>
      <td :title="feature.properties.distance + ' nm'">{{ feature.properties.distance.toFixed(2) }} nm</td>
      <td :title="feature.properties.GS + ' kt'">{{ Math.round(feature.properties.GS) }} kt</td>
      <td :title="feature.properties.time + ' h'">{{ Math.round(feature.properties.time * 60) }} m</td>
      <td :title="feature.properties.accumulatedTime + ' h'">{{ Math.round(feature.properties.accumulatedTime * 60) }} m</td>
      <td><input :tabindex="(idx * 10) + 7" v-if="idx === 0" type="time" v-model="feature.properties.eto" @change="handleInputChange" /></td>
      <td style="width: 30px"><input :tabindex="(idx * 10) + 8" v-if="idx === 0" type="number" v-model="feature.properties.fuel" @change="handleInputChange" /><span v-if="idx === 0"> l/h</span></td>
      <td :title="feature.properties.accumulatedFuel + ' l'">{{ Math.round(feature.properties.accumulatedFuel) }}l</td>
    </tr>
  </table>
</div>
</template>

<script>
import {
    ref
} from 'vue'

import {
    Collection,
} from "ol"

import {
    Vector
} from "ol/source";

import {
  getLength
} from 'ol/sphere';

import {
  getCenter
} from 'ol/extent';

import axios from "axios";

import lineIntersect from '@turf/line-intersect'
import lineChunk from '@turf/line-chunk'
import nearestPoint from '@turf/nearest-point'
import bearing from '@turf/bearing'
// import along from '@turf/along'
// import length from '@turf/length'
import distance from '@turf/distance'
// import lineSliceAlong from '@turf/line-slice-along'
import lineSegment from '@turf/line-segment'
import bbox from '@turf/bbox'
import { polygon, lineString, point, featureCollection, bearingToAzimuth } from '@turf/helpers'
import proj4 from 'proj4'

import GeoJSON from 'ol/format/GeoJSON.js';
import geoJson from '../assets/geojson/es.json'
import geoJsonCities from '../assets/geojson/cities.json'

const format = new GeoJSON()

export default {
  setup() {
    const map = ref(null)
    const center = ref([1971109.7306613524, 8278523.006620626])
    const zoom = ref(10.5)
    const rotation = ref(0)
    const projection = "EPSG:3857"

    const features = format.readFeatures(geoJson, { featureProjection: "ESPG:4326" })
    const cities = format.readFeatures(geoJsonCities, { featureProjection: "ESPG:4326" })

    const flightTiles = ref('https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=2213/aero/latest')

    const showFlightOverlay = ref(true)
    const drawEnable = ref(true)
    const modifyEnable = ref(false)
    const snapToAirports = ref(false)
    const lastWeatherFetch = ref(null)
    const drawType = ref("LineString")
    const intersects = ref([])

    const planeCoordinates = ref([])

    const routes4326 = ref([])
    const routeDistance = ref(0)
    const selectedFeatures = ref(new Collection())
    const journeyLegs = ref(new featureCollection([]))
    const fiveMinuteMarks = ref(new featureCollection([]))
    const weather = ref(new featureCollection([]))
    const lineSegments = ref({
      features: []
    })


    const airportsCollection = featureCollection(features.filter(f => f.getProperties().type === 'airport')
      .map(f => point(
        proj4('EPSG:3857', 'EPSG:4326', f.getGeometry().getCoordinates()),
        f.getProperties()
      ))
    )

    const restrictedCollection = featureCollection(features.filter(f => f.getProperties().type === 'restricted')
      .map(f => point(
        proj4('EPSG:3857', 'EPSG:4326', getCenter(f.getGeometry().getExtent())),
        f.getProperties()
      ))
    )

    const holdingPointsCollection = featureCollection(features.filter(f => f.getProperties().type === 'holding_point')
      .map(f => point(
        proj4('EPSG:3857', 'EPSG:4326', f.getGeometry().getCoordinates()),
        f.getProperties()
      ))
    )

    const entryPointsCollection = featureCollection(features.filter(f => f.getProperties().type === 'entry_point')
      .map(f => point(
        proj4('EPSG:3857', 'EPSG:4326', f.getGeometry().getCoordinates()),
        f.getProperties()
      ))
    )

    const citiesCollection = featureCollection(cities.map(f => point(
        f.getGeometry().getCoordinates(),
        f.getProperties()
      ))
    )

    const poiCollection = featureCollection([
      ...airportsCollection.features,
      ...restrictedCollection.features,
      ...holdingPointsCollection.features,
      ...entryPointsCollection.features,
      ...citiesCollection.features,
    ])

    const findClosestAirport = (coordinates) => {
      coordinates = proj4('EPSG:3857', 'EPSG:4326', coordinates)
      const coord = point(coordinates)
      return nearestPoint(coord, airportsCollection)
    }

    const findClosestPOI = (coordinates) => {
      const coord = point(coordinates)
      let np = nearestPoint(coord, poiCollection)
      if (np.properties.distanceToPoint > 5)
        np = { properties: { name: "Okänt riktmärke" }}
      return np
    }

    const findClosest = (coordinates, featureCollection) => {
      const coord = point(coordinates)
      let np = nearestPoint(coord, featureCollection)
      return np
    }

    const getWeatherAtCoordinates = (coordinates, projection="EPSG:4326") => {
      console.log("Get weather at", coordinates)
      if (projection != "EPSG:4326")
        coordinates = proj4(projection, "EPSG:4326", coordinates)

      let url = `https://opendata-download-metanalys.smhi.se/api/category/mesan1g/version/2/geotype/point/lon/${coordinates[0].toFixed(2)}/lat/${coordinates[1].toFixed(2)}/data.json`

      lastWeatherFetch.value = new Date()

      axios
        .get(url)
        .then(response => {
          let properties = {
            "windSpeed": Math.round(response.data.timeSeries[0].parameters.find(p => p.name === "ws").values[0] * 1.94384449),
            "windDirection": response.data.timeSeries[0].parameters.find(p => p.name === "wd").values[0],
            "temperature": response.data.timeSeries[0].parameters.find(p => p.name === "t").values[0],
          }

          let feature = point(coordinates, properties)

          weather.value.features.push(feature)
          calculateLineInfo(selectedFeatures.value.array_[0])
        }
      )
    }

    const findIntersects = (segment, altitude = 0) => {
      let geometry = segment.geometry
      let _intersects = []

      const coordinates = geometry.coordinates
      const extent = bbox(geometry)
      const nearbyfeatures = features.filter(f => f.getGeometry().intersectsExtent(extent))

      const espg4326ls = lineString(coordinates.map(c => proj4('EPSG:3857', 'EPSG:4326', c)))
      const chunks = lineChunk(espg4326ls, 1)

      chunks.features.forEach(chunk => {
        let ls = lineString(chunk.geometry.coordinates.map(c => proj4('EPSG:4326', 'EPSG:3857', c)))

        nearbyfeatures.forEach(r => {
          const previous_intersects = [...intersects.value, ..._intersects]
          let lower_limit = r.get('lower_limit')
          let upper_limit = r.get('upper_limit')

          if (r.get('lower_limit_unit') === "FL")
            lower_limit *= 100

          if (r.get('upper_limit_unit') === "FL")
            upper_limit *= 100

          if (altitude < lower_limit) {
            return
          }

          if (altitude >= upper_limit) {
            return
          }

          const properties = r.getProperties()
          let intersect = null

          if (previous_intersects.filter(i => i.get("name") === r.get("name")).length > 0) {
            return false
          }

          switch (properties.shape) {
            case "Polygon":
              intersect = lineIntersect(ls, polygon(r.getGeometry().getCoordinates()))
              break;
            case "Point":
              if (!properties.radius)
                return false;
              break;
          }

          if (intersect && intersect.features.length > 0) {
            // r.set("distance", distance(planeCoordinates, r.getGeometry().getCoordinates()))
            r.set("intersect", intersect.features[0])
            r.set("trueTrack", segment["trueTrack"])
            _intersects.push(r)
          }
        })
      })

      return _intersects
    }

    const modifyend = (event) => {
      calculateLineInfo(event.features.array_[0])
    }

    const drawend = (event) => {
      calculateLineInfo(event.feature)
      selectedFeatures.value.push(event.feature)
      modifyEnable.value = true
      drawEnable.value = false

//      for (var idx in journeyLegs.value.features) {
//        console.log("A", journeyLegs.value.features[idx].geometry.coordinates)
//      }
    }

    Math.radians = function(degrees) {
        return degrees * Math.PI / 180;
    }

    Math.degrees = function(radians) {
        return radians * 180 / Math.PI;
    }

    const handleInputChange = (event) => {
      event.target.focus()
      calculateLineInfo(selectedFeatures.value.array_[0], event.target)
    }

    const handleClickDelete = (event) => {
      if (event.pixel) {
//        const feature = map.value.forEachFeatureAtPixel(event.pixel, function (feature) {
//          return feature;
//        });
//
//        console.log(feature)
      }
    }

    const turnDirection = (current, target) => {
      let diff = target - current;
      if(diff < 0)
        diff += 360;

      if(diff > 180)
        return -1; // left turn

      else
        return 1; // right turn
    }

    const addMinutes = (time, minutes) => {
      if (typeof(time) === "string") {
        let [h, m] = time.split(':');
        time = new Date()
        time.setHours(h, m, 0)
      }

      return new Date(time.getTime() + minutes * 60000);
    }

    const toTimeString = (time, convertToUTC = false) => {
      let hours = time.getHours()
      let minutes = time.getMinutes()

      if (convertToUTC) {
        hours = time.getUTCHours()
        minutes = time.getUTCMinutes()
      }

      return ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2)
    }

    const handleClickGetWeather = () => {
      if (lineSegments.value.features.length == 0)
        return

      journeyLegs.value.features.map(s => {
          s.properties.windDirection = null
          s.properties.windSpeed = null
          s.properties.temperature = null

          let coordinates = s.geometry.coordinates
          getWeatherAtCoordinates(coordinates[1])
      })
    }

    const calculateLineInfo = (feature, referrer = null) => {
      const geometry = feature.getGeometry()
      intersects.value = []

      let accumulatedTime = 0
      let f = format.writeFeatureObject(feature, { featureProjection: "EPSG:4326" })
      lineSegments.value = lineSegment(f)
      fiveMinuteMarks.value.features = []

      lineSegments.value.features.forEach((segment, idx) => {
        const _c = segment.geometry.coordinates.map(c => proj4('EPSG:3857', 'EPSG:4326', c))
        const feature = lineString(_c)
        let oldValues = {}

        if (journeyLegs.value.features[idx])
          oldValues = journeyLegs.value.features[idx].properties
        else if (journeyLegs.value.features[idx - 1])
          oldValues = journeyLegs.value.features[idx - 1].properties

        journeyLegs.value.features[idx] = feature

        segment.geometry["coordinates3857"] = segment.geometry.coordinates.map(c => proj4('EPSG:4326', 'EPSG:3857', c))
        segment["trueTrack"] = parseInt(bearingToAzimuth(bearing(_c[0], _c[1])))

        if (segment["trueTrack"] === 0)
          segment["trueTrack"] = 360

        if (weather.value.features.length > 0) {
          const closestWeatherReport = findClosest(_c[1], weather.value)
          if (!oldValues["windDirection"])
            oldValues["windDirection"] = closestWeatherReport.properties.windDirection

          if (!oldValues["windSpeed"])
            oldValues["windSpeed"] = closestWeatherReport.properties.windSpeed

          if (!oldValues["temperature"])
            oldValues["temperature"] = closestWeatherReport.properties.temperature
        }

        segment["windDirection"] = oldValues["windDirection"] || 0
        segment["windInverseDirection"] = segment["windDirection"] > 180 ? segment["windDirection"] - 180 : segment["windDirection"] + 180;
        segment["windSpeed"] = oldValues["windSpeed"] || 0
        segment["windAngle"] = Math.radians(segment["windDirection"] - segment["trueTrack"])
        segment["altitude"] = oldValues["altitude"] || 1000
        segment["temperature"] = oldValues["temperature"] || 0
        segment["TAS"] = oldValues["TAS"] || 100
        segment["windCorrectionAngle"] = Math.degrees(Math.asin((segment["windSpeed"] / segment["TAS"]) * Math.sin(segment["windAngle"])))
        segment["trueHeading"] = segment["trueTrack"] + segment["windCorrectionAngle"]

        if (segment["trueHeading"] < 0)
          segment["trueHeading"] = 360 + segment["trueHeading"]

        if (segment["trueHeading"] > 360)
          segment["trueHeading"] = segment["trueHeading"] - 360

        segment["variation"] = oldValues["variation"] || 6
        segment["magneticHeading"] = segment["trueHeading"] + (segment["variation"] * -1)

        if (segment["magneticHeading"] < 0)
          segment["magneticHeading"] = 360 + segment["magneticHeading"]

        if (segment["magneticHeading"] > 360)
          segment["magneticHeading"] = segment["magneticHeading"] - 360

        segment["deviation"] = oldValues["deviation"] || 0
        segment["compassHeading"] = segment["magneticHeading"] - segment["deviation"]

        if (segment["compassHeading"] < 0)
          segment["compassHeading"] = 360 + segment["compassHeading"]

        if (segment["compassHeading"] > 360)
          segment["compassHeading"] = segment["compassHeading"] - 360

        segment["distance"] = distance(_c[0], _c[1], {units: 'kilometers'}) * 0.539956803
        segment["GS"] = segment["TAS"] * Math.sqrt(1 - Math.pow((segment["windSpeed"] / segment["TAS"]) * Math.sin(segment["windAngle"]), 2)) - segment["windSpeed"] * Math.cos(segment["windAngle"])
        segment["time"] = segment["distance"] / segment["GS"]
        segment["fuel"] = oldValues["fuel"] || 15
        segment["accumulatedTime"] = accumulatedTime + segment["time"]

        let fuelPerHour = journeyLegs.value.features[0].properties["fuel"]
        if (idx == 0)
          fuelPerHour = segment["fuel"]

        segment["accumulatedFuel"] = segment["accumulatedTime"] * fuelPerHour

        let firstPoi = findClosestPOI(_c[0])
        let secondPoi = findClosestPOI(_c[1])

        segment["firstPoi"] = firstPoi
        segment["secondPoi"] = secondPoi
        segment["description"] = `${firstPoi.properties.name} till ${secondPoi.properties.name}`
        segment["lastWeatherFetch"] = oldValues["lastWeatherFetch"] || null;

        if (!oldValues["lastWeatherFetch"] || new Date() - oldValues["lastWeatherFetch"] > (300 * 1000)) {
          segment["lastWeatherFetch"] = new Date()

          if (segment["windDirection"] == 0)
            segment["windDirection"] = weather.value["windDirection"]

          if (oldValues["windSpeed"] == 0)
            oldValues["windSpeed"] = weather.value["windSpeed"]
        }

        segment["previousTrueTrack"] = 0
        let now = new Date();
        if (idx === 0) {
          const timeUtc = ("0" + now.getUTCHours()).slice(-2) + ":" + ("0" + now.getUTCMinutes()).slice(-2)
          segment["eto"] = oldValues["eto"] || timeUtc
        }
        else {
          segment["previousTrueTrack"] = journeyLegs.value.features[idx - 1].properties["trueTrack"]

          const originalEto = journeyLegs.value.features[0].properties["eto"] || oldValues["eto"]
          const lastTimeInMinutes = Math.round(journeyLegs.value.features[idx - 1].properties["accumulatedTime"] * 60)
          const timeInMinutes = Math.round(segment["time"] * 60)

          const eto = addMinutes(originalEto, lastTimeInMinutes)

          const timeUtc = toTimeString(addMinutes(originalEto, lastTimeInMinutes))
          const timeUtcSecondPoi = toTimeString(addMinutes(eto, timeInMinutes))

          segment["eto"] = timeUtc
          segment["etoSecondPoi"] = timeUtcSecondPoi
        }

        segment["turnDirection"] = turnDirection(segment["previousTrueTrack"], segment["trueTrack"])

        segment["text"] = `${segment["eto"]}\n${firstPoi.properties.name}\nTT ${Math.round(segment["trueTrack"])}°\nMH ${Math.round(segment["magneticHeading"])}°`
        segment["textSecondPoi"] = `${segment["etoSecondPoi"]}\n${secondPoi.properties.name}`

        feature.properties = {
          ...segment,
          ...feature.properties,
        }

        const fiveMinDistance = segment["GS"] * (5 / 60)
        const fiveMinChunks = lineChunk(feature, fiveMinDistance * 1.852, {units: 'kilometers'})

        for (let idx = 0; idx < fiveMinChunks.features.length; idx++) {
          let _ls = fiveMinChunks.features[idx]

          let coords = _ls.geometry.coordinates
          let stopIndex = coords.length

          if (idx === fiveMinChunks.features.length -1)
            stopIndex -= 1

          for (let i = 0; i < stopIndex; i++) {
            let feature = point(coords[i], {...segment})
            fiveMinuteMarks.value.features.push(feature)
          }
        }

        accumulatedTime += segment["time"]
        intersects.value.push(...findIntersects(segment, feature.properties.altitude))
      })

      routeDistance.value = getLength(geometry)

      if (referrer) {
        console.log("FOCUS ON", referrer)
        referrer.focus()
      }
    }

    return {
      map,
      planeCoordinates,
      center,
      zoom,
      rotation,
      projection,
      flightTiles,
      showFlightOverlay,
      drawEnable,
      modifyEnable,
      snapToAirports,
      lastWeatherFetch,
      drawType,
      drawend,
      modifyend,
      selectedFeatures,
      lineSegments,
      journeyLegs,
      fiveMinuteMarks,
      weather,
      routes4326,
      routeDistance,
      intersects,
      features,
      findClosestAirport,
      findIntersects,
      calculateLineInfo,
      handleInputChange,
      handleClickDelete,
      handleClickGetWeather,
      getWeatherAtCoordinates,
      proj4,
    }
  },
  emits: ['planeAzimuth', 'planeSpeed'],
  methods: {
    penClick() {
      this.intersects = [];
      this.routes4326 = [];
      this.selectedFeatures = [];
      this.drawEnable = !this.drawEnable;
    },
    startSimulation() {
      this.speed += 10;
    },
    stopSimulation() {
      var sourceVector = new Vector({features: this.selectedFeatures})
      sourceVector.removeFeature(sourceVector.getFeatures()[0]);
      console.log(sourceVector)
      console.log(sourceVector.getFeatures())
      this.speed = 0;
    },
    zoomChanged(currentZoom) {
      this.currentZoom = currentZoom;
    },
    resolutionChanged(resolution) {
      this.currentResolution = resolution;
    },
    centerChanged(center) {
      this.currentCenter = center;
    },
    rotationChanged(rotation) {
      this.currentRotation = rotation;
    },
  },
  watch: {
    planeAzimuth: {
      handler: function() {
        this.$emit('planeAzimuth', this.planeAzimuth)
      }
    },
    speed: {
      handler: function() {
        this.$emit('planeSpeed', this.speed)
      }
    }
  }
}
</script>

<style scoped>
table#routePlan {
  width: 100%;
  border-spacing: 0px;
  border-collapse: separate;
}

table#routePlan td {
  width: 4%;
}

table#routePlan input {
  width: 40px;
}

table#routePlan input.char3 {
  width: 30px;
}

table#routePlan input[type="time"] {
  width: 50px;
}

table#routePlan td.narrow {
  width: 2%;
}

table#routePlan td.wide {
  width: 24%;
}

td {
  border-right: 1px solid #eee;
  border-bottom: 1px solid #eee;
  margin: 0px;
  padding: 2px;
}

.zoom {
  bottom: 10px !important;
  right: 10px !important;
}

.zoom button {
  background-color: white !important;
  color: black !important;
}

.zoomButton.plus {
  border-radius: 5px 5px 0 0;
}

.zoomButton.minus {
  border-radius: 0 0 5px 5px;
}

.zoomButton:hover {
  background: #ccc;
}

th {
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
}

div.mapControls {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: white;
  width: 140px;
  height: 50px;
}

div.routePlan {
  position: absolute;
  width: 100%;
  height: auto;
  max-height: 30vh;
  overflow-x:auto;
  overflow-y: scroll;
  background-color: white;
  top: 0;
  padding: 10px;
  box-sizing: border-box;
}
</style>
