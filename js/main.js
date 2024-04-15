// Pseudo-global variables
var attrArray = ["POP_GROWTH_PCT_SINCE_2000", "MEDIAN_INCOME", "UNEMPLOYMENT_RATE", "POVERTY_RATE", "EDUCATION_LEVEL"];
var expressed = attrArray[0]; // Initial attribute
var csvData, map, colorScale, yScale; // Define globally for access in multiple functions

// Begin script when window loads
window.onload = function() {
  setMap();
  createDropdown(attrArray);
};

// Set up choropleth map

function setMap() {
  var width = window.innerWidth * 0.5,
      height = 460;

  map = d3.select("body")
      .append("svg")
      .attr("class", "map")
      .attr("width", width)
      .attr("height", height);

  var projection = d3.geoAlbers()
      .rotate([115, 0, 0])
      .center([-2, 38.5])
      .parallels([35, 43])
      .scale(3000)
      .translate([width / 2, height / 2]);

  var path = d3.geoPath().projection(projection);
  var promises = [
      d3.csv("data/Nevada_Counties_SIMPLIFIED.csv"),
      d3.json("data/Nevada_Counties_SIMPLIFIED.json")
  ];

  Promise.all(promises).then(function(data) {
      csvData = data[0];
      var nevadaTopojson = data[1];
      var nevadaCounties = topojson.feature(nevadaTopojson, nevadaTopojson.objects.Nevada_Counties_SIMPLIFIED);
      nevadaCounties.features.forEach(function(feature) {
          var countyData = csvData.find(function(d) { return d.NAME === feature.properties.NAME; });
          if (countyData) {
              feature.properties = {...feature.properties, ...countyData};
          }
      });
      colorScale = makeColorScale(nevadaCounties.features);
      setEnumerationUnits(nevadaCounties, map, path, colorScale);
      setChart(csvData, colorScale);
  });

  // Function to set enumeration units and apply color scale
  function setEnumerationUnits(counties, map, path, colorScale) {
    var regions = map.selectAll(".county")
      .data(counties.features)
      .enter()
      .append("path")
      .attr("class", function (d) {
        return "county " + d.properties.NAME;
      })
      .attr("d", path)
      .style("fill", function (d) {
        var value = d.properties[expressed];
        if (value) {
          return colorScale(value);
        } else {
          return "#ccc"; // Assign a neutral color for missing values
        }
      });
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
}

// Define color scale function using Natural Breaks
function makeColorScale(data) {
  var domainArray = data.map(function(d) {
      return +d.properties[expressed];
  });
  var clusters = ss.ckmeans(domainArray, 9);
  domainArray = clusters.map(function(d) { return d3.min(d); });
  domainArray.shift();
  return d3.scaleThreshold().domain(domainArray).range([
      "#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"
  ]);
}




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

  // Create the color scale using Natural Breaks
  var colorScale = makeColorScale(nevadaCounties.features);

  // Add enumeration units to the map
  setEnumerationUnits(nevadaCounties, map, path, colorScale);

  // Add coordinated visualization to the map
  setChart(csvData, colorScale);
}


// Function to create coordinated bar chart
function setChart(csvData, colorScale) {

  yScale = d3.scaleLinear()
  .range([463, 0])
  .domain([0, d3.max(csvData, function (d) { return parseFloat(d[expressed]); })]);

    // Chart frame dimensions remain the same as you've defined them
    var chartWidth = window.innerWidth * 0.45,
        chartHeight = 460,
        leftPadding = 0,
        rightPadding = 0,
        topBottomPadding = 0,
        chartInnerWidth = chartWidth,
        chartInnerHeight = chartHeight,
        translate = "translate(0,0)";

    // No change in creating the SVG container for the chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    // No change to the chart background creation
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate)
        .attr("fill", "white");


    // Adjust `x` attribute calculation for the bars
    var bars = chart.selectAll(".bar")
    .data(csvData)
    .enter()
    .append("rect")
    .sort(function (a, b) { return b[expressed] - a[expressed]; })
    .attr("class", function (d) { return "bar " + d.NAME; })
    .attr("width", chartInnerWidth / csvData.length - 1)
    .attr("x", function (d, i) {
        var totalBarsWidth = csvData.length * (chartInnerWidth / csvData.length);
        var startingPoint = chartWidth - rightPadding - totalBarsWidth;
        return i * (chartInnerWidth / csvData.length) + startingPoint;
    })
    .attr("height", function (d) { return 463 - yScale(parseFloat(d[expressed])); })
    .attr("y", function (d) { return yScale(parseFloat(d[expressed])); })
    .style("fill", function (d) { return colorScale(d[expressed]); });

        // Update existing bars
        bars.enter()
        .append("rect")
        .merge(bars)
        .transition()
        .duration(500)
        .attr("y", function(d) { return yScale(parseFloat(d[expressed])); })
        .attr("height", function(d) { return 463 - yScale(parseFloat(d[expressed])); })
        .style("fill", function(d) { return colorScale(d[expressed]); });

    bars.exit().remove(); // Remove any unneeded bars
    // Annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
      .data(csvData)
      .enter()
      .append("text")
      .sort(function (a, b) { return b[expressed] - a[expressed]; })
      .attr("class", function (d) { return "numbers " + d.NAME; })
      .attr("text-anchor", "middle")
      .attr("x", function (d, i) {
        var fraction = chartInnerWidth / csvData.length;
        return i * fraction + (fraction - 1) / 2 + leftPadding;
      })
      .attr("y", function (d) { return yScale(parseFloat(d[expressed])) + 15 + topBottomPadding; })
      .text(function (d) { return d[expressed]; });

    // Calculate the desired offset from the center
    var offset = 200; // Example offset value; adjust as needed

    // Adjusted chart title to always be centered within the chart box
    var chartTitle = chart.append("text")
      .attr("x", chartWidth / 2) // Center the title by setting x to half of chartWidth
      .attr("y", 40)
      .attr("class", "chartTitle")
      .style("text-anchor", "middle") // Ensure the title is centered on the x position
      .text("Population Growth (%)");

    chartTitle.append("tspan")
      .attr("x", chartWidth / 2) // Also center the second line of the title
      .attr("y", 65)
      .style("text-anchor", "middle") // Center the text for the tspan as well
      .text("since 2000 in Nevada Counties");

}



function updateChart(csvData, colorScale) {
  yScale = d3.scaleLinear()
  .range([463, 0])
  .domain([0, d3.max(csvData, function (d) { return parseFloat(d[expressed]); }) * 1.2]);

  var bars = d3.selectAll(".bar")
  .sort(function (a, b) { return b[expressed] - a[expressed]; })
  .data(csvData, d => d.NAME);

  bars.enter()
      .append("rect")
      .merge(bars)
      .transition()
      .duration(500)
      .attr("height", d => 463 - yScale(parseFloat(d[expressed])))
      .attr("y", d => yScale(parseFloat(d[expressed])))
      .style("fill", d => colorScale(d[expressed]));

  bars.exit().remove();

  // Update the bar labels
  var numbers = d3.selectAll(".numbers")
      .data(csvData, d => d.NAME);

  numbers.enter()
      .append("text")
      .merge(numbers)
      .transition()
      .duration(500)
      .attr("y", d => yScale(parseFloat(d[expressed])) + 15)
      .text(d => d[expressed]);

  numbers.exit().remove();
}

function updateMap(colorScale) {
  d3.selectAll(".county")
    .transition()
    .duration(500)
    .style("fill", function(d) {
      var value = d.properties[expressed];
      return value ? colorScale(value) : "#ccc";
    });
}




// Add a function to create the dropdown for attribute selection
function createDropdown(attrArray) {
  var dropdown = d3.select("body")
      .append("select")
      .attr("class", "dropdown")
      .on("change", function() {
          changeAttribute(this.value);
      });

  dropdown.selectAll("option")
      .data(attrArray)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => d);
}


// Call createDropdown in your window.onload function
window.onload = function() {
  setMap();
  createDropdown(["POP_GROWTH_PCT_SINCE_2000", "MEDIAN_INCOME", "UNEMPLOYMENT_RATE", "POVERTY_RATE", "EDUCATION_LEVEL"]); // Update this list based on your dataset
};


function changeAttribute(attribute) {
  expressed = attribute;
  colorScale = makeColorScale(map.selectAll(".county").data());
  d3.selectAll(".county")
      .transition()
      .duration(500)
      .style("fill", d => {
          var value = d.properties[expressed];
          return value ? colorScale(value) : "#ccc";
      });

      d3.select(".chartTitle")
      .text(function() {
          switch (expressed) {
              case "POP_GROWTH_PCT_SINCE_2000":
                  return "Population Growth (%)";
              case "MEDIAN_INCOME":
                  return "Median Income";
              case "UNEMPLOYMENT_RATE":
                  return "Unemployment Rate";
              case "POVERTY_RATE":
                  return "Poverty Rate";
              case "EDUCATION_LEVEL":
                  return "Education Level";
              default:
                  return "";
          }
      });
  
  d3.select(".chartTitle + tspan")
      .text(function() {
          switch (expressed) {
              case "POP_GROWTH_PCT_SINCE_2000":
                  return "since 2000 in Nevada Counties";
              case "MEDIAN_INCOME":
                  return "in Nevada Counties";
              case "UNEMPLOYMENT_RATE":
                  return "in Nevada Counties";
              case "POVERTY_RATE":
                  return "in Nevada Counties";
              case "EDUCATION_LEVEL":
                  return "in Nevada Counties";
              default:
                  return "";
          }
      });

  updateChart(csvData, colorScale);
}