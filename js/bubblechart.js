window.onload = function() {
    // SVG container dimensions
    var w = 900, h = 500;
    var container = d3.select("body")
                      .append("svg")
                      .attr("width", w)
                      .attr("height", h)
                      .attr("class", "container")
                      .style("background-color", "rgba(0,0,0,0.2)");

    // Inner rectangle for chart background
    container.append("rect")
             .attr("width", 800)
             .attr("height", 400)
             .attr("class", "innerRect")
             .attr("x", 50)
             .attr("y", 50)
             .style("fill", "#FFFFFF");

    // City populations dataset
    var cityPop = [
        { city: 'Madison', population: 233209 },
        { city: 'Milwaukee', population: 594833 },
        { city: 'Green Bay', population: 104057 },
        { city: 'Superior', population: 27244 }
    ];


    // Find the minimum and maximum population in the dataset
    var minPop = d3.min(cityPop, function(d) {
        return d.population;
    });

    var maxPop = d3.max(cityPop, function(d) {
        return d.population;
    });

    // Scale for the y-axis should cover the domain from min to max population
    var yScale = d3.scaleLinear()
                   .range([h-50, 50]) // Adjusted range to provide space for labels
                   .domain([0 - minPop, maxPop + (maxPop / 5)]); // Extend domain beyond max population

    // Scale for circle radius based on population area
    var scaleRadius = d3.scaleSqrt()
                        .domain([0, maxPop + maxPop / 5])
                        .range([0, 50]); // Adjust range to provide a maximum size for the circles

    // Color scale for circles
    var colorScale = d3.scaleSequential()
                       .domain([0, maxPop])
                       .interpolator(d3.interpolateReds);

    // Creating circles
    container.selectAll(".circles")
             .data(cityPop)
             .enter()
             .append("circle")
             .attr("class", "circles")
             .attr("id", d => d.city)
             .attr("r", d => scaleRadius(d.population))
             .attr("cx", (d, i) => 180 + (i * 180))
             .attr("cy", d => yScale(d.population))
             .style("fill", d => colorScale(d.population));

    // Creating the y-axis
    var yAxis = d3.axisLeft(yScale)
                  .ticks(15);

    // Adding the y-axis to the container
    container.append("g")
             .attr("class", "axis")
             .attr("transform", "translate(50, 0)")
             .call(yAxis)
             .selectAll(".tick line") // Select all the tick lines

    // Adding the chart title
    container.append("text")
             .attr("class", "title")
             .attr("text-anchor", "middle")
             .attr("x", w / 2)
             .attr("y", 30)
             .text("City Populations");

    // Creating labels for each circle
    var labels = container.selectAll(".labels")
                          .data(cityPop)
                          .enter()
                          .append("text")
                          .attr("class", "labels")
                          .attr("text-anchor", "start");

    // City name line
    labels.append("tspan")
          .attr("class", "nameLine")
          .attr("x", (d, i) => 180 + (i * 180) + scaleRadius(d.population) + 5)
          .attr("y", d => yScale(d.population))
          .text(d => d.city);

    // Population line
    labels.append("tspan")
          .attr("class", "popLine")
          .attr("x", (d, i) => 180 + (i * 180) + scaleRadius(d.population) + 5)
          .attr("dy", "1.2em")
          .text(d => `Pop. ${d3.format(",")(d.population)}`);
};
