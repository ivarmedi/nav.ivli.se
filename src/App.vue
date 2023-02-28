<template>
  <!--
  <MagneticCompass :rotation="planeAzimuth" left="10" bottom="10" />
  <SpeedoMeter :speed="planeSpeed" left="220" bottom="10" />
  -->
  <FlightMap @planeAzimuth="updatePlaneAzimuth($event)" @planeSpeed=updatePlaneSpeed($event) />
</template>

<script>
import FlightMap from './components/FlightMap.vue'
// import MagneticCompass from './components/MagneticCompass.vue'
// import SpeedoMeter from './components/SpeedoMeter.vue'

export default {
  name: 'App',
  components: {
    FlightMap,
//    MagneticCompass,
//    SpeedoMeter,
  },
  data() {
    return {
      planeAzimuth: 0,
      planeSpeed: 0,
    }
  },
  methods: {
    updatePlaneAzimuth(event) {
      this.planeAzimuth = parseInt(event)
    },
    updatePlaneSpeed(event) {
      this.planeSpeed = parseInt(event)
    },
  }
}
</script>

<style>
html, body {
  height: 100%;
  overflow: hidden;
  padding: 0;
  margin: 0;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
  width: 100%;
}
</style>
