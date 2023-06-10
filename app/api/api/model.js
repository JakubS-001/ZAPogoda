const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

const model_dir = './model';
const model_name = 'model';

const dayOfYear = date =>
    Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

function prepare_data(data) {
    return data.map(record => {
        const date = new Date(record.date * 1000);
        return {
            day: parseFloat(dayOfYear(date)),
            hour: parseFloat(date.getHours()),
            temp: parseFloat(record.temp),
            humid: parseFloat(record.humid),
            wind_s: parseFloat(record.wind_s),
            wind_d: parseFloat(record.wind_d),
            pm25: parseFloat(record.pm25),
            pm10: parseFloat(record.pm10),
            co2: parseFloat(record.co2)
        };
    });
}

async function load_model() {
    const model_path = path.join(model_dir, model_name, 'model.json');
    const model = await tf.loadLayersModel(`file://${model_path}`);
    model.compile({loss: 'meanSquaredError', optimizer: 'adam'});
    return model;
}

async function train_model(data) {
    data = prepare_data(data);

    const X = [], Y = [];
    for (let i = 24; i < data.length - 24; i++) {
        const input = data.slice(i - 24, i).map(record => [
            record.day, record.hour, record.temp, record.humid, record.wind_s,
            record.wind_d, record.pm25, record.pm10, record.co2
        ]);
        const output = data.slice(i, i + 24).map(record => [
            record.temp, record.humid, record.wind_s, record.wind_d,
            record.pm25, record.pm10, record.co2
        ]);
	if (input.every((val, i, arr) => (i != 0) ? val[1] === (arr[i - 1][1] + 1) % 24 : true)) {
            X.push(input);
            Y.push(output);
	}
    }

    const xs = tf.tensor3d(X);
    const ys = tf.tensor3d(Y);

    const model = tf.sequential();
    model.add(tf.layers.inputLayer({inputShape: [24, 9]}));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({units: 381, activation: 'relu'}));
    model.add(tf.layers.dense({units: 762, activation: 'relu'}));
    model.add(tf.layers.dense({units: 1524, activation: 'relu'}));
    model.add(tf.layers.dense({units: 3048, activation: 'relu'}));
    model.add(tf.layers.dense({units: 1524, activation: 'relu'}));
    model.add(tf.layers.dense({units: 762, activation: 'relu'}));
    model.add(tf.layers.dense({units: 381, activation: 'relu'}));
    model.add(tf.layers.dense({units: 168, activation: 'linear'}));
    model.add(tf.layers.reshape({ targetShape: [24, 7] }));

    model.compile({loss: 'meanSquaredError', optimizer: 'adam'});

    await model.fit(xs, ys, {epochs: 2000, shuffle: true});

    const model_path = path.join(model_dir, model_name);
    await model.save(`file://${model_path}`);

    global.model = model;
}

async function update_model(data) {
    if (!global.model)
        return -1;
    data = prepare_data(data);

    const X = [], Y = [];
    for (let i = 24; i < data.length - 24; i++) {
        const input = data.slice(i - 24, i).map(record => [
            record.day, record.hour, record.temp, record.humid, record.wind_s,
            record.wind_d, record.pm25, record.pm10, record.co2
        ]);
        const output = data.slice(i, i + 24).map(record => [
            record.temp, record.humid, record.wind_s, record.wind_d,
            record.pm25, record.pm10, record.co2
        ]);
	if (input.every((val, i, arr) => (i != 0) ? val[1] === (arr[i - 1][1] + 1) % 24 : true)) {
            X.push(input);
            Y.push(output);
	}
    }

    const xs = tf.tensor3d(X);
    const ys = tf.tensor3d(Y);

    await model.fit(xs, ys, {epochs: 200, shuffle: true});

    const model_path = path.join(model_dir, model_name);
    await model.save(`file://${model_path}`);
}

async function predict(data) {
    if (!global.model)
        return -1;
    const new_data = prepare_data(data);

    const input = new_data.map(record => [record.day, record.hour, record.temp, record.humid, record.wind_s, record.wind_d, record.pm25, record.pm10, record.co2]);
    const xs = tf.tensor3d([input]);

    const ys = await model.predict(xs);

    const predictions = Array.from(ys.dataSync());

    let last = data[data.length - 1].date;
    const output = [];
    for (let i = 0; i < predictions.length; i += 7) {
        const array = predictions.slice(i, i + 7);
        output.push({
            date: (last += 3600),
            temp: array[0],
            humid: array[1],
            wind_s: array[2],
            wind_d: array[3],
            pm25: array[4],
            pm10: array[5],
            co2: array[6]
        });
    }

    return output;
}

exports.load_model = load_model;
exports.train_model = train_model;
exports.update_model = update_model;
exports.predict = predict;
exports.model_dir = model_dir;
exports.model_name = model_name;
