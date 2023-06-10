const {RegUUID, PERM_PUSH, PERM_OVERWRITE, colnames, checkPerms, send, wind_directions} = require('./includes');

app.post('/api/:key', (req, res) => {
    const key = req.params.key;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const records = req.body.records;
    const overwrite = req.body.overwrite;
    const ret = req.body.return;

    if (!RegUUID.test(key)) {
        send(res, 400, {message: 'Invalid UUID'},
            `Invalid UUID from ${ip}  Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`);
        return;
    }

    app.db.query(`SELECT perms, status FROM api_keys WHERE key = '${key}'`).then(async result => {
        if (!result.rows.length) {
            send(res, 401, {message: 'API key does not exit'},
                `API key does not exit from ${ip}  Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`);
            return;
        }

        const perms = parseInt(result.rows[0].perms);
        if (!checkPerms(perms, PERM_PUSH)) {
            send(res, 403, {message: 'You do not have push permissions to perform this action'},
                `No push permissions from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`);
            return;
        }

        if (overwrite && !checkPerms(perms, PERM_OVERWRITE)) {
            send(res, 403, {message: 'You do not have overwrite permissions to perform this action'},
                `No overwrite permissions from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`);
            return;
        }

        if (!records) {
            send(res, 400, {message: 'Records not provided'},
                `Records not provided from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`);
            return;
        }

        let query = ''; 
        if (ret)
            query += 'WITH returned AS ('

        query += `INSERT INTO records
            (${colnames.join(',')})
            VALUES`

        let dates = [];

        let recs = [];
        for (const record of records) {
            let parsed;
	        let rec = [];
            if (record.date) {
                if (isNaN(parsed = Number(record.date)) &&
                    isNaN(parsed = Math.floor(Date.parse(record.date) / 1000))) {
                    send(res, 400, {message: 'Invalid date'},
                        `Invalid date from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
                    return;
                }
                dates.push(`to_timestamp('${parsed}')`)
            } else {
                send(res, 400, {message: 'Date is null'},
                    `Date is null from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
                return;
            }
            rec.push(`to_timestamp('${parsed}')`)
            for (const col of colnames.slice(1)) {
                if (record[col] != undefined) {
                    if (isNaN(Number(record[col]))) {
                        send(res, 400, {message: `Invalid record ${col}`},
                            `Invalid record ${col} from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
                        return;
                    }
                    if (result.rows[0].status == 1) {
                        if (col == "wind_d")
                            rec.push(`'${wind_directions[parseInt(record[col])]}'`)
                        else
                            rec.push(`'${record[col]}'`);
                    } else {
                        rec.push(`'${record[col]}'`);
                    }

                } else {
                    rec.push(`null`);
                }
            }
            recs.push(rec);
        }
        query += ` (${recs.join('),(')})`;

        if (overwrite)
            query += ` ON CONFLICT (date) DO UPDATE 
                SET ${colnames.map(x => `${x} = excluded.${x}`).join(',')}`;
                
        else
            query += ` ON CONFLICT (date) DO NOTHING`;

        let result0;
        if (ret) {
            try {
                result0 = await app.db.query(`SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date, ${colnames.slice(1).join(', ')}
                    FROM records WHERE date IN (${dates}) ORDER BY date`);
                query += ' RETURNING *';
            } catch (err) {
                send(res, 500, {message: 'Database request failed'},
                    `Database request failed from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
                console.error(err);
            }
        }

        if (ret)
            query += `) SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date, ${colnames.slice(1).join(', ')} FROM returned ORDER BY date`;
        query += ';';

        app.db.query(query).then(result1 => {
            let response = {};
            response.message = 'Succesfully inserted to database';
            if (ret) {
                if (overwrite) response.old_records = result0.rows;
                else response.ignored_records = result0.rows;
                response.new_records = result1.rows;
            }

            send(res, 200, response,
                `Inserted to database from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
        }).catch(err => {
            send(res, 500, {message: 'Database request failed'},
                `Database request failed from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
            console.error(err);
        })
    }).catch(err => {
        send(res, 500, {message: 'Database request failed'},
            `Database request failed from ${ip}   Request: ${req.url}	Data: ${JSON.stringify(req.body.records)}`)
        console.error(err);
    });
});
