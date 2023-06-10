const table = document.getElementById('data');
const tbody = table.getElementsByClassName('table-body')[0];
const cols = ['date', 'temp', 'humid', 'wind_s', 'wind_d', 'pm25', 'pm10', 'co2'];
const wind_d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','NWN','NW','NNW'];

fetch('https://zapogoda.xyz/api/e42d83f7-0ad6-417f-9804-1b093402c52e/records/all?order=desc&limit=3')
.then(response => response.json())
.then(data => {
    const records = data.records;

    let tr = document.createElement('tr');
    let td = document.createElement('td');

    for (let record of records) {
        let row = tr.cloneNode();
        td.innerText = new Date(record.date * 1000).toLocaleTimeString();
        row.appendChild(td.cloneNode(true));

        for (let col of cols.slice(1)) {
            td.innerText = col == 'wind_d' ?
			wind_d[Math.round(record[col])] :
			Math.round(record[col] * 100) / 100;
            row.appendChild(td.cloneNode(true));
        }

        tbody.appendChild(row);
    }
})

//const vid = document.createElement('video');
//const main = document.getElementsByClassName('main')[0];
//vid.src = "robots.mp4";
//vid.style.width = '100%';
//vid.loop = "true";
//document.onclick = () => {main.prepend(vid); vid.play();};
