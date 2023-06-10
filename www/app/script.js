function newChart(id, title, label, labels, data, length, color) {
    new Chart(id, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: label,
                fill: true,
                cubicInterpolationMode: 'monotone',
                tension: 0.4,
                pointRadius: 5,
                data: data,
                pointBackgroundColor:
                    ctx => ctx.dataIndex >= length ?
                        `rgba(${color[0]},${color[1]},${color[2]},0.3)` :
                        `rgba(${color[0]},${color[1]},${color[2]},0.5)`, 
                pointBorderColor:
                    ctx => ctx.dataIndex >= length ?
                        `rgba(${color[0]},${color[1]},${color[2]},0.8)` :
                        `rgba(${color[0]},${color[1]},${color[2]},1)`, 
                segment: {
                    borderColor:
                        ctx => ctx.p0DataIndex >= length - 1 ?
                            `rgba(${color[0]},${color[1]},${color[2]},0.3)` :
                            `rgba(${color[0]},${color[1]},${color[2]},1)`, 
                    backgroundColor:
                        ctx => ctx.p0DataIndex >= length - 1 ?
                            `rgba(${color[0]},${color[1]},${color[2]},0.1)` :
                            `rgba(${color[0]},${color[1]},${color[2]},0.2)`,
                    borderDash:
                        ctx => ctx.p0DataIndex >= length - 1 ? [6, 6] : [0, 0]
                }
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return (context[0].dataIndex < length) ?
                                `Historyczne ${context[0].label}` :
                                `Przewidywane ${context[0].label}`;
                        }
                    }
                }
            }
        },
    });

}

//fetch("https://zapogoda.xyz/api/e42d83f7-0ad6-417f-9804-1b093402c52e/records/last?hours=12&average=true&order=asc")
fetch("https://zapogoda.xyz/api/e42d83f7-0ad6-417f-9804-1b093402c52e/records/all?average=true&order=desc&limit=12")
.then(response => response.json())
.then(async data => {
    //let records = data.records;
    let records = data.records.reverse();
    let len = records.length;
    let datestart = records[records.length - 1].date + 3600;
    let predictions = await fetch(`https://zapogoda.xyz/api/e42d83f7-0ad6-417f-9804-1b093402c52e/predictions/range?datestart=${datestart}`)
        .then(response => response.json())
    predictions = predictions.records;
    let full = records.concat(predictions);
    let dates = full.map(x => (new Date(x.date * 1000)).toLocaleTimeString());
    let temp = full.map(y => y.temp);
    let humid = full.map(y => y.humid);
    let wind_s = full.map(y => y.wind_s);
    let wind_d = full.map(y => y.wind_d);
    let pm25 = full.map(y => y.pm25);
    let pm10 = full.map(y => y.pm10);
    let co2 = full.map(y => y.co2);

    console.log(predictions);

    newChart("chart1", "Temperatura (°C)", "Temperatura", dates, temp, len, [255, 157, 52]);

    newChart("chart2", "Wilgotność (%)", "Wilgotność", dates, humid, len, [52, 157, 255]);

    newChart("chart3", "Prędkość wiatru (km/h)", "Prędkość wiatru", dates, wind_s, len, [164, 52, 255]);

    newChart("chart4", "Stężenie PM2.5 (μg/m³)", "Stężenie PM2.5", dates, pm25, len, [238, 194, 0]);

    newChart("chart5", "Stężenie PM10 (μg/m³)", "Stężenie PM10", dates, pm10, len, [255, 43, 43]);

    newChart("chart6", "Poziom CO₂ (ppm)", "Poziom CO₂", dates, co2, len, [255, 52, 137]);

});
