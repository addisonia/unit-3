// Pseudo-global variables
var attrArray = ["POP_GROWTH_PCT_SINCE_2000"]; // List of attributes
var expressed = attrArray[0]; // Initial attribute

// Begin script when window loads
window.onload = setMap;

// Set up choropleth map
function setMap() {
  // Map frame dimensions
  var width = window.innerWidth * 0.9,
    height = 460;
  var scale = 2500;

  // Create new svg container for the map
  var map = d3
    .select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

  // Create Albers equal area conic projection centered on Nevada
  var projection = d3
    .geoAlbers()
    .center([0, 38]) // Nevada's approximate latitude
    .rotate([116, 0, 0]) // Nevada's approximate longitude
    .parallels([35, 43]) // Standard parallels for USA
    .scale(scale)
    .translate([width / 2, height / 2]);

  // Path generator using the Albers projection
  var path = d3.geoPath().projection(projection);

  // Use Promise.all to parallelize asynchronous data loading
  var promises = [
    d3.csv("data/Nevada_Counties_SIMPLIFIED.csv"),
    d3.json("data/Nevada_Counties_SIMPLIFIED.json"), // Adjusted for .json
  ];
  Promise.all(promises).then(callback);

  function callback(data) {
    var csvData = data[0]; // CSV attribute data
    var nevadaTopojson = data[1]; // TopoJSON spatial data

    // Translate TopoJSON to GeoJSON
    var nevadaCounties = topojson.feature(
      nevadaTopojson,
      nevadaTopojson.objects.Nevada_Counties_SIMPLIFIED
    );

    // Join the CSV data to the GeoJSON features
    nevadaCounties.features.forEach(function (feature) {
      var countyName = feature.properties.NAME;
      var countyData = csvData.find(function (d) {
        return d.NAME === countyName;
      });

      if (countyData) {
        feature.properties = Object.assign({}, feature.properties, countyData);
      }
    });

    // // Define a color scale for the choropleth map
    // var colorScale = d3
    //   .scaleSequential(d3.interpolateViridis)
    //   .domain(
    //     d3.extent(nevadaCounties.features, function (d) {
    //       return +d.properties.POP_GROWTH_PCT_SINCE_2000;
    //     })
    //   );

  // Create the color scale using Natural Breaks
  var colorScale = makeColorScale(nevadaCounties.features);

  // Add enumeration units to the map
  setEnumerationUnits(nevadaCounties, map, path, colorScale);


  // Define a color scale for the choropleth map using Natural Breaks
function makeColorScale(data) {
    var colorClasses = [
      "#f7fcf0",
      "#e0f3db",
      "#ccebc5",
      "#a8ddb5",
      "#7bccc4",
      "#4eb3d3",
      "#2b8cbe",
      "#0868ac",
      "#084081"
    ];
  
    // Create color scale generator
    var colorScale = d3.scaleThreshold()
      .range(colorClasses);
  
    // Build array of all values of the expressed attribute
    var domainArray = data.map(function(d) {
      return +d.properties[expressed];
    });
  
    // Cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, colorClasses.length);
  
    // Set domain array to cluster minimums
    domainArray = clusters.map(function(d) {
      return d3.min(d);
    });
  
    // Remove first value from domain array to create class breakpoints
    domainArray.shift();
  
    // Assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);
  
    return colorScale;
  }

    // Draw Nevada counties on the map
    map
      .selectAll(".county")
      .data(nevadaCounties.features)
      .enter()
      .append("path")
      .attr("class", "county")
      .attr("d", path)
      .attr("fill", function (d) {
        return colorScale(+d.properties.POP_GROWTH_PCT_SINCE_2000);
      });

    // Add a legend
    var legend = d3
      .legendColor()
      .scale(colorScale)
      .title("Population Growth (%) since 2000")
      .labelFormat(d3.format(".2f"));

    map
      .append("g")
      .attr("transform", "translate(20, 20)")
      .call(legend);
  }

  // Create graticule generator
  var graticule = d3.geoGraticule().step([5, 5]);

  // Draw graticule background
  var gratBackground = map
    .append("path")
    .datum(graticule.outline()) // Bind graticule background
    .attr("class", "gratBackground") // Assign class for styling
    .attr("d", path); // Project graticule

  // Draw graticule lines
  var gratLines = map
    .selectAll(".gratLines") // Select graticule elements that will be created
    .data(graticule.lines()) // Bind graticule lines to each element to be created
    .enter() // Create an element for each datum
    .append("path") // Append each element to the svg as a path element
    .attr("class", "gratLines") // Assign class for styling
    .attr("d", path); // Project graticule lines


    function setEnumerationUnits(counties, map, path, colorScale) {
        var regions = map.selectAll(".county")
            .data(counties.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
            return "county " + d.properties.NAME;
            })
            .attr("d", path)
            .style("fill", function(d) {
            var value = d.properties[expressed];
            if (value) {
                return colorScale(value);
            } else {
                return "#ccc"; // Assign a neutral color for missing values
            }
        });
    }
}