const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const distance = require('@turf/distance');
const circleToPolygon = require("circle-to-polygon");
const xml2json = require('xml2json');
const yauzl = require('yauzl');
const query_overpass = require('query-overpass')

const tmpdir = os.tmpdir()
const zip_filename = path.join(tmpdir, "ofmx.zip")
const ofmx_filename = path.join(tmpdir, "ofmx.xml")
const assets_dir = "src/assets/geojson"

const featureCollection = {
  "type": "FeatureCollection",
  "features": []
}

const sectors = {
  "LAHOLM SECTOR": "HALMSTAD",
  "KLIPPAS SECTOR": "LJUNGBYHED",
  "UPPSALA SECTOR": "STOCKHOLM",
  "NYKÖPING SECTOR": "ÖSTGÖTA",
  "NORRKÖPING SECTOR": "ÖSTGÖTA",
  "LINKÖPING SECTOR": "ÖSTGÖTA",
  "SÅTENÄS SECTOR": "GÖTEBORG",
  "TROLLHÄTTAN SECTOR": "GÖTEBORG",
}

const convertCoordinates = (lon, lat) => {
  var x = (lon * 20037508.34) / 180;
  var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
}

const parseAirports = (nodes) => {
  for (var idx in nodes.Ahp) {
    let type = "Feature"
    let node = nodes.Ahp[idx]
    let geometry = {
      type: "Point",
      coordinates: []
    }
    let properties = {
      id: node.AhpUid["mid"],
      icao: node.AhpUid.codeId,
      name: node.txtName,
      radius: 500,
      type: 'airport',
      runways: [],
    }

    const runways = nodes.Rwy.filter(rwy => rwy.RwyUid.AhpUid.mid === properties["id"])

    properties.runways = properties.runways.concat(runways.map(rwy => rwy.RwyUid.txtDesig.split("/")).flat())

    if (properties.runways.length <= 1)
      continue

    let lon = parseFloat(node.geoLong)
    let lat = parseFloat(node.geoLat)
    geometry.coordinates = convertCoordinates(lon, lat)

    featureCollection.features.push({
      type,
      geometry,
      properties
    })
  }
}

const parse = (filename) => {
  fs.readFile(filename, function(err, data) {
    const json = xml2json.toJson(data, { object: true });
    const nodes = json["OFMX-Snapshot"]
    const ase_properties = []
    let idx = 0

    for (idx in nodes.Ase) {
      let ase = nodes.Ase[idx]
      let properties = {}

      if (ase.AseUid.codeType == "FIR") {
        continue
      }

      properties["id"] = ase.AseUid["mid"]
      properties["airspace_class"] = ase.codeClass
      properties["name"] = ase.AseUid.codeId
      properties["upper_limit"] = ase.valDistVerUpper
      properties["upper_limit_unit"] = ase.uomDistVerUpper
      properties["lower_limit"] = ase.valDistVerLower
      properties["lower_limit_unit"] = ase.uomDistVerLower
      properties["name"] = ase.txtName

      switch (ase.AseUid.codeType) {
        // Restricted
        case "R":
          properties["type"] = "restricted"
          properties["name"] = ase.AseUid.codeId.replace(/^(.*?) ([0-9]+)$/g, 'R$2 $1');
          break;
        // Danger
        case "D":
          properties["type"] = "danger"
          properties["name"] = ase.AseUid.codeId.replace(/^(.*?) ([0-9]+)$/g, 'D$2 $1');
          break;
        // Radio mandated zone
        case "RMZ":
          if (properties["name"].endsWith("TIZ")) {
            properties["type"] = "tiz"
            properties["name"] = ase.AseUid.codeId.replace(/^(.*?) [A-Z]{1} TIZ$/g, '$1');
          } else {
            continue
          }

          break;
        // TMA
        case "TMA":
          properties["type"] = "tma"
          properties["name"] = ase.AseUid.codeId.replace(/^(.*?) [A-Z]$/g, '$1');

          if (properties["name"].startsWith("AREA")) {
            continue
          }

          if (properties["name"].endsWith("SECTOR")) {
            properties["name"] = sectors[properties["name"]]
            // Calculate which TMA this sector belongs to later
            // continue
          }

          if (properties["name"] === "VÄSTERÅS") {
            properties["name"] = "STOCKHOLM"
          }

          properties["name"] += " TMA"
          break;
        // CTR
        case "CTR":
          properties["type"] = "ctr"
          properties["name"] = `${ase.AseUid.codeId} CTR`
          break;
        default:
          continue;
      }

      ase_properties.push(properties)
    }

    // Borders
    for (idx in nodes.Abd) {
      let type = "Feature"
      let abd = nodes.Abd[idx]
      let geometry = {
        type: "Polygon",
        coordinates: [
          []
        ]
      }
      let properties = ase_properties.filter(p => p.id === abd.AbdUid.AseUid.mid)[0]

      if (!properties || properties.length === 0) {
        continue
      }

      if (!Array.isArray(abd.Avx)) {
        abd.Avx = [abd.Avx]
      }

      // Correct "three" legged polygons
      if (abd.Avx.filter(a => (a.codeType === "GRC" || a.codeType === "FNT")).length < 4) {
        abd.Avx.push(abd.Avx[0])
      }

      if (abd.Avx.filter(a => (a.codeType === "GRC" || a.codeType === "FNT")).length >= 4) {
        abd.Avx.forEach(avx => {
          let lon = parseFloat(avx.geoLong)
          let lat = parseFloat(avx.geoLat)

          geometry.coordinates[0].push(
            convertCoordinates(lon, lat)
          )
        })
      } else if (abd.Avx.filter(a => a.codeType == "CWA").length > 0) {
        let avx = abd.Avx.filter(a => a.codeType == "CWA")[0]
        let lon = parseFloat(avx.geoLongArc)
        let lat = parseFloat(avx.geoLatArc)
        let outerLon = parseFloat(avx.geoLong)
        let outerLat = parseFloat(avx.geoLat)
        properties["radius"] = distance.default([lon, lat], [outerLon, outerLat]) * 1000

        geometry = circleToPolygon([lon, lat], properties["radius"])
        geometry.coordinates[0] = geometry.coordinates[0].map(c => convertCoordinates(c[0], c[1]))
      } else {
        console.log("UNKNOWN TYPE", abd)
        continue
      }

      properties["shape"] = geometry.type

      featureCollection.features.push({
        type,
        geometry,
        properties
      })
    }

    // Designated points
    for (idx in nodes.Dpn) {
      let type = "Feature"
      let node = nodes.Dpn[idx]
      let geometry = {
        type: "Point",
        coordinates: []
      }
      let properties = {
        id: node.DpnUid["mid"],
        name: node.txtName,
        radius: 500,
      }

      switch (node.codeType) {
        case "VFR-RP":
          properties["type"] = "holding_point"
          break;
        case "VFR-MRP":
          properties["type"] = "entry_point"
          break;
        default:
          continue
      }

      let lon = parseFloat(node.DpnUid.geoLong)
      let lat = parseFloat(node.DpnUid.geoLat)
      geometry.coordinates = convertCoordinates(lon, lat)

      featureCollection.features.push({
        type,
        geometry,
        properties
      })
    }

    // Airports
    parseAirports(nodes)

    const filename = path.join(assets_dir, "es.json")

    fs.writeFile(filename, JSON.stringify(featureCollection), (err) => {
      if (err) throw err;

      console.log("Wrote", filename)
    })
  })
}

async function download_overpass() {
  const filename = path.join(assets_dir, "cities.json")

  return new Promise((resolve, reject) => {
    // Get city data from the Overpass API
    query_overpass('[out:json][timeout:25];area[name="Sverige"];(node["place"="town"](area);node["place"="city"](area););out body;>;out skel qt;', (err, data) => {
      if (err)
        reject(err)

      data.features.map(f => {
        f.properties = {
          ...f.properties,
          ...f.properties.tags,
          tags: null,
        }
      })

      fs.writeFile(filename, JSON.stringify(data), (err) => {
        if (err)
          reject(err)

        console.log("Wrote", filename)
        resolve(true)
      })
    })
  })
}

async function download_ofmx() {
  return new Promise((resolve, reject) => {
    const url = "https://snapshots.openflightmaps.org/live/2213/ofmx/esaa/latest/ofmx_es.zip"

    // Download open flight data and parse it into geojson
    axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer'
    }).then(response => {
      fs.writeFile(zip_filename, response.data, (err) => {
        if (err)
          reject(err)

        yauzl.open(zip_filename, {lazyEntries: true}, function(err, zipfile) {
          if (err)
            reject(err)

          zipfile.readEntry();
          zipfile.on("entry", function(entry) {
            if (entry.fileName !== "ofmx_es/embedded/ofmx_es") {
              zipfile.readEntry();
            } else {
              zipfile.openReadStream(entry, function(err, readStream) {
                if (err) throw err;

                let buffer = null;
                readStream.on("data", function(d) {
                  if(!buffer){
                    buffer = d;
                  }else{
                    buffer = Buffer.concat([buffer, d]);
                  }
                });


                readStream.on('end', function () {
                  fs.writeFile(ofmx_filename, buffer, () => {
                    resolve(ofmx_filename)
                  })
                });

              });
            }
          })
        })

    //    fs.rmSync(filename)
      })
    })
  })
}

const run = () => {
  download_overpass().catch((err) => {
    console.error("Failed to download overpass data", err)
  })

  download_ofmx().then(filename => {
    parse(filename)
    fs.rmSync(zip_filename)
    fs.rmSync(ofmx_filename)
  })
}

run()
