const fs = require('fs');
const { cols, colnames } = require('./api/includes');
const { load_model, train_model, update_model, predict, model_dir, model_name } = require('./api/model');

async function update_predictions() {
    if (!global.model)
        return;
    let res;
    try {
        res = await app.db.query(`SELECT EXTRACT(EPOCH FROM DATE_TRUNC('hour', date + INTERVAL '30 minutes'))::INTEGER AS date, ${colnames.slice(1).map(x => x != "wind_d" ? `AVG(${x}) AS ${x}` : 'circavg(wind_d) as wind_d').join(', ')} FROM records WHERE DATE_TRUNC('hour', date + INTERVAL '30 minutes') <= DATE_TRUNC('hour', NOW()) GROUP BY DATE_TRUNC('hour', date + INTERVAL '30 minutes') ORDER BY date DESC LIMIT 24;`);
        res = res.rows.reverse();
    } catch (err) {
        console.error(err);
    }

    const predictions = await predict(res); 

    console.log(predictions);

    app.db.query(`INSERT INTO predictions (${colnames.join(',')}) VALUES
        (${predictions.map(x => {const res = [`to_timestamp(${x['date']})`]; colnames.slice(1).forEach(name => res.push(isNaN(x[name]) ? "NULL" : x[name])); return res}).join('),(')})
        ON CONFLICT (date) DO UPDATE SET ${colnames.map(x => `${x} = excluded.${x}`).join(',')};`)
        .then(() => {
            console.log("Successfully updated predictions.")
        }).catch(err => {
            console.error(err);
        });
}

async function model_update() {
    if (!global.model)
        return;
    let last;
    try {
        last = await app.db.query(`SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date FROM updates ORDER BY date DESC LIMIT 1;`);
        last = last.rows[0].date;
    } catch (err) {
        console.error(err);
    }

    let res;
    try {
        res = await app.db.query(`SELECT EXTRACT(EPOCH FROM DATE_TRUNC('hour', date + INTERVAL '30 minutes'))::INTEGER AS date, ${colnames.slice(1).map(x => x != "wind_d" ? `AVG(${x}) AS ${x}` : 'circavg(wind_d) as wind_d').join(', ')} FROM records WHERE DATE_TRUNC('hour', date + INTERVAL '30 minutes') <= DATE_TRUNC('hour', NOW()) GROUP BY DATE_TRUNC('hour', date + INTERVAL '30 minutes') ORDER BY date ASC;`);
    } catch (err) {
        console.error(err);
    }

    const update = res.rows[res.rows.length - 1].date;

    await update_model(res.rows);

    app.db.query(`INSERT INTO updates (date) VALUES (to_timestamp('${update}'));`)
        .then(() => {
            console.log("Successfully updated model.")
        }).catch(err => {
            console.error(err);
        });

    update_predictions();
}

function start_intervals() {
    let now = new Date();
    let next_hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    let time = next_hour - now;

    setTimeout(() => {
        model_update();
    	update_predictions();
        setInterval(model_update, 3600000);
    }, time);
}

(async () => {
    const express = require('express')
    const pg = require("pg");
    require("dotenv").config();

    const app = express();

    app.db = new pg.Client({
        host: process.env.PG_HOST,
        port: process.env.PG_PORT,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE
    })

    global.app = app;
    global.express = express;

    await app.db.connect();

    const table = cols.map(x => x.join(' ')).join(',');

    await app.db.query(`CREATE TABLE IF NOT EXISTS records (${table});`);

    await app.db.query(`CREATE TABLE IF NOT EXISTS predictions (${table});`);

    await app.db.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
            key UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            perms BIGINT
        );`);

    await app.db.query(`
        CREATE TABLE IF NOT EXISTS updates (
            key SERIAL NOT NULL PRIMARY KEY,
            date TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL
        );`);

    await app.db.query(`
        CREATE OR REPLACE FUNCTION f_circavg (float[], integer)
            RETURNS float[] LANGUAGE sql STRICT AS
        'SELECT ARRAY[$1[1] + sin($2 * pi() / 8), $1[2] + cos($2 * pi() / 8), 1]';
        
        CREATE OR REPLACE FUNCTION f_circavg_final (float[])
            RETURNS real LANGUAGE sql AS
        'SELECT CASE WHEN $1[3] > 0 THEN (
            CASE WHEN atan2($1[1], $1[2]) < 0
                THEN (atan2($1[1], $1[2]) + 2 * pi()) / pi() * 8
                ELSE atan2($1[1], $1[2]) / pi() * 8
            END)
        END';
        
        CREATE OR REPLACE AGGREGATE circavg (integer) (
            sfunc     = f_circavg,
            stype     = float[],
            finalfunc = f_circavg_final,
            initcond  = '{0,0,0}'
        );`);

    if (!fs.existsSync(`${model_dir}/${model_name}`)) {
        const data = await app.db.query(`SELECT EXTRACT(EPOCH FROM DATE_TRUNC('hour', date + INTERVAL '30 minutes'))::INTEGER AS date, ${colnames.slice(1).map(x => x != "wind_d" ? `AVG(${x}) AS ${x}` : 'circavg(wind_d) as wind_d').join(', ')} FROM records WHERE DATE_TRUNC('hour', date + INTERVAL '30 minutes') <= DATE_TRUNC('hour', NOW()) GROUP BY DATE_TRUNC('hour', date + INTERVAL '30 minutes') ORDER BY date ASC;`)
        const rows = data.rows;
        const update = rows[data.rows.length - 1].date;
        await app.db.query(`INSERT INTO updates (date) VALUES (to_timestamp('${update}'));`);
    console.log(rows)
        train_model(rows);
    } else {
        global.model = await load_model();
    }

    await update_predictions()

    //model_update();
    start_intervals();

    require("./api");

    app.listen(process.env.APP_PORT, () => {
        console.log(`Listening on port ${process.env.APP_PORT}`);
    });
})();

