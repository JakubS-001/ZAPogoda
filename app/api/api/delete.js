const {RegUUID, PERM_DELETE, checkPerms, send} = require('./includes');

app.delete('/api/:key/:mode', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = req.params.key;
    const mode = req.params.mode;
    let timestamps = req.query.timestamp;
    let datestart = req.query.datestart;
    let dateend = req.query.dateend;

    if (!RegUUID.test(key)) {
        send(res, 400, {message: 'Invalid UUID'},
            `Invalid UUID from ${ip}  Request: ${req.url}`);
        return;
    }

    app.db.query(`SELECT perms FROM api_keys WHERE key = '${key}'`).then(result => {
        if (!result.rows.length) {
            send(res, 401, {message: 'API key does not exit'},
                `API key does not exit from ${ip}  Request: ${req.url}`);
            return;
        }

        const perms = parseInt(result.rows[0].perms);
        if (!checkPerms(perms, PERM_DELETE)) {
            send(res, 403, {message: 'You do not have delete permissions to perform this action'},
                `No delete permissions from ${ip}   Request: ${req.url}`);
            return;
        }
        
        if (!mode) {
            send(res, 403, {message: 'Request mode not specified'},
                `Mode not specified from ${ip}   Request: ${req.url}`);
            return;
        }

        switch (mode) {
            case 'all': {
                app.db.query(`WITH returned AS (DELETE FROM records RETURNING *)
                              SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date, ${colnames.slice(1).join(', ')} FROM returned ORDER BY DATE;`)
                .then(result => {
                    let result0 = {
                        message: "Succesfully removed all rows", records: result.rows
                    };
                    send(res, 200, result0,
                        `Deleted all rows from ${ip}   Request: ${req.url}`);
                }).catch(err => {
                    send(res, 500, {message: 'Database request failed'},
                        `Database request failed from ${ip}   Request: ${req.url}`);
                    console.error(err);
                });
            } break;
            case 'timestamps': {
                if (!timestamps) {
                    send(res, 400, {message: 'Timestamps not provided'},
                        `Timestamps not provided from ${ip}   Request: ${req.url}`);
                    break;
                }
                if (!Array.isArray(timestamps))
                    timestamps = [timestamps];

                let err = false;
                let query = `WITH returned AS (DELETE FROM records WHERE`
                for (let i = 0; i < timestamps.length; i++) {
                    let parsed;
                    if (isNaN(parsed = Number(timestamps[i])) &&
                        isNaN(parsed = Math.floor(Date.parse(timestamps[i]) / 1000))) {
                        err = true;
                        break;
                    }
                    query += `${i ? ' OR' : ''} date = to_timestamp('${parsed}')`
                }
                    
                if (err) {
                    send(res, 400, {message: 'Invalid timestamp'},
                        `Invalid timestamp from ${ip}   Request: ${req.url}`);
                    break;
                }

                query += ` RETURNING *) SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date, ${colnames.slice(1).join(', ')} FROM returned ORDER BY date;`;
                
                app.db.query(query).then(result => {
                    let result0 = {
                        message: "Succesfully removed selected rows",
                        records: result.rows
                    };
                    send(res, 200, result0,
                        `Deleted timestamps ${timestamps.join(', ')} from ${ip}   Request: ${req.url}`);
                }).catch(err => {
                    send(res, 500, {message: 'Database request failed'},
                        `Database request failed from ${ip}   Request: ${req.url}`);
                    console.error(err);
                });

            } break;
            case 'range': {
                if (!datestart && !dateend) {
                    send(res, 400, {message: 'Dates not provided'},
                        `Dates not provided from ${ip}   Request: ${req.url}`);
                    break;
                }
                let parsedstart, parsedend;
                if (datestart &&
                    isNaN(parsedstart = Number(datestart)) &&
                    isNaN(parsedstart = Math.floor(Date.parse(datestart) / 1000))) {
                    send(res, 400, {message: 'Invalid start date'},
                        `Invalid start date from ${ip}   Request: ${req.url}`);
                    break;
                }
                if (dateend &&
                    isNaN(parsedend = Number(dateend)) &&
                    isNaN(parsedend = Math.floor(Date.parse(dateend) / 1000))) {
                    send(res, 400, {message: 'Invalid end date'},
                        `Invalid end date from ${ip}   Request: ${req.url}`);
                    break;
                }

                let query = `WITH returned AS (DELETE FROM records WHERE `
                if (datestart && dateend) {
                    query += `date BETWEEN to_timestamp('${parsedstart}') AND to_timestamp('${parsedend}')`
                } else if (datestart) {
                    query += `date >= to_timestamp('${parsedstart}')`
                } else {
                    query += `date <= to_timestamp('${parsedend}')`
                }
                query += ` RETURNING *) SELECT EXTRACT(EPOCH FROM date)::INTEGER AS date, ${colnames.slice(1).join(', ')} FROM returned ORDER BY date;`;

                app.db.query(query).then(result => {
                    let result0 = {
                        message: "Succesfully removed range of rows",
                        records: result.rows
                    };
                    send(res, 400, result0,
                        `Requested range from ${datestart} to ${dateend} from ${ip}   Request: ${req.url}`);
                }).catch(err => {
                    send(res, 500, {message: 'Database request failed'},
                        `Database request failed from ${ip}   Request: ${req.url}`);
                    console.error(err);
                });
                
            } break;
            default: {
                send(res, 400, {message: 'Invalid request mode'}, 
                    `Invalid mode from ${req.socket.remoteAddress}   Request: ${req.url}`)
            } break;
        }

    }).catch(err => {
        send(res, 500, {message: 'Database request failed'},
            `Database request failed from ${ip}   Request: ${res.url}`)
        console.error(err);
    });

});

