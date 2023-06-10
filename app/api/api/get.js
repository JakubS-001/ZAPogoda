const {RegUUID, PERM_READ, colnames, checkPerms, send, aunits} = require('./includes');
const colns = colnames.slice(1);

app.get('/api/:key/:table/:mode', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const table = req.params.table;
    const key = req.params.key;
    const mode = req.params.mode;
    let timestamps = req.query.timestamp;
    let datestart = req.query.datestart;
    let dateend = req.query.dateend;
    let time = [
        {val: req.query.seconds, mult: 1},
        {val: req.query.minutes, mult: 60},
    	{val :req.query.hours, mult: 3600},
        {val: req.query.days, mult: 86400}
    ];
    let limit = req.query.limit;
    let order = req.query.order;
    let orderby = req.query.orderby;
    let average = req.query.average;
    let averageby = req.query.averageby;

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
        if (!checkPerms(perms, PERM_READ)) {
            send(res, 403, {message: 'You do not have read permissions to perform this action'},
                `No read permissions from ${ip}   Request: ${req.url}`);
            return;
        }

        if (!["records", "predictions"].includes(table)) {
            send(res, 400, {message: 'Invalid database'},
                `Invalid database from ${ip}  Request: ${req.url}`);
            return;
        }
        
        if (!mode) {
            send(res, 403, {message: 'Request mode not specified'},
                `Mode not specified from ${ip}   Request: ${req.url}`);
            return;
        }

        if (typeof(order) != "string" || !["ASC", "DESC"].includes(order.toUpperCase())) {
            if (!order) {
                order = "ASC";
            } else {
                send(res, 400, {message: "Invalid order mode"},
                    `Invalid order mode from ${ip}   Request: ${req.url}`);
                return;
            }
        }

        if (!colnames.includes(orderby)) {
            if (!orderby) {
                orderby = "date";
            } else {
                send(res, 400, {message: "Invalid order column"},
                    `Invalid order column from ${ip}   Request: ${req.url}`);
                return;
            }
        }

        if (!['days','hours'].includes(averageby)) {
            if (!averageby) {
                averageby = "hours";
            } else {
                send(res, 400, {message: "Invalid averaging mode"},
                    `Invalid averaging mode from ${ip}   Request: ${req.url}`);
                return;
            }
        }

        let date_trunc;
        if (average) {
            date_trunc = `date_trunc('${averageby}', date + interval '${aunits[averageby]}')`;
        }

        if (limit) {
            limit = Math.trunc(Number(limit));
            if (isNaN(limit)) {
                send(res, 400, {message: "Invalid limit"},
                    `Invalid limit from ${ip}   Request: ${req.url}`);
                return;
            }
        }

        const qstart = `SELECT EXTRACT(EPOCH FROM ${average ? date_trunc : 'date'})::INTEGER AS date, 
                    ${average ? colns.map(x => x != "wind_d" ? `AVG(${x}) AS ${x}` : 'circavg(wind_d) as wind_d').join(', ') : colns.join(', ')} FROM ${table}`
        const qend = `${average ? `GROUP BY ${date_trunc}` : ''} 
                    ORDER BY ${orderby} ${order} ${limit ? `LIMIT ${limit}` : ''};`

        switch (mode) {
            case 'all': {
                app.db.query(`${qstart} 
                    ${average ? `WHERE ${date_trunc} <= date_trunc('${averageby}', Now())` : ''} 
                    ${qend}`
                ).then(result => {
                    send(res, 200,
                        {message: "Successfully fetched all records",
                        records: result.rows},
                        `Requested all rows from ${ip}   Request: ${req.url}`);
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
                let query = `${qstart} WHERE`
                for (let i = 0; i < timestamps.length; i++) {
                    let parsed;
                    if (isNaN(parsed = Math.floor(Number(timestamps[i]))) &&
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

		query += `${average ? `AND ${date_trunc} <= date_trunc('${averageby}', Now())` : ''} ${qend}`;
                
                app.db.query(query).then(result => {
                    send(res, 200,
                        {message: "Successfully fetched selected records",
                        records: result.rows},
                        `Requested timestamps ${timestamps.join(', ')} from ${ip}   Request: ${req.url}`);
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
                    isNaN(parsedstart = Math.floor(Number(datestart))) &&
                    isNaN(parsedstart = Math.floor(Date.parse(datestart) / 1000))) {
                    send(res, 400, {message: 'Invalid start date'},
                        `Invalid start date from ${ip}   Request: ${req.url}`);
                    break;
                }
                if (dateend &&
                    isNaN(parsedend = Math.floor(Number(dateend))) &&
                    isNaN(parsedend = Math.floor(Date.parse(dateend) / 1000))) {
                    send(res, 400, {message: 'Invalid end date'},
                        `Invalid end date from ${ip}   Request: ${req.url}`);
                    break;
                }

                let query = `${qstart} WHERE `
                if (datestart && dateend) {
                    query += `date BETWEEN to_timestamp('${parsedstart}') AND to_timestamp('${parsedend}')`
                } else if (datestart) {
                    query += `date >= to_timestamp('${parsedstart}')`
                } else {
                    query += `date <= to_timestamp('${parsedend}')`
                }
		query += `${average ? ` AND ${date_trunc} <= date_trunc('${averageby}', Now())` : ''} ${qend}`;

                app.db.query(query).then(result => {
                    send(res, 200, 
                        {message: "Successfully fetched range of records",
                        records: result.rows},
                        `Requested range from ${datestart} to ${dateend} from ${ip}   Request: ${req.url}`);
                }).catch(err => {
                    send(res, 500, {message: 'Database request failed'},
                        `Database request failed from ${ip}   Request: ${req.url}`);
                    console.error(err);
                });
                
            } break;
            case "last": {
                let seconds = 0;
                let err0 = true;
                let err1 = false;
                for (const el of time) {
                    let val;
                    if (el.val) {
                        err0 = false;
                        if(!isNaN(val = Math.floor(Number(el.val))))
                            seconds += val * el.mult;
                        else
                            err1 = true;
                    }
                }

                if (err0) {
                    send(res, 400, {message: 'Time not provided'},
                        `Time not provided from ${ip}   Request: ${req.url}`);
                    break;
                }

                if (err1) {
                    send(res, 400, {message: 'Invalid time'},
                        `Invalid time from ${ip}   Request: ${req.url}`);
                    break;
                }

                query = `${qstart}
                    WHERE EXTRACT(EPOCH FROM date)::INTEGER >= EXTRACT(EPOCH FROM NOW())::INTEGER - ${seconds}
		    ${average ? `AND ${date_trunc} <= date_trunc('${averageby}', Now())` : ''} ${qend}`;

                app.db.query(query).then(result => {
                    send(res, 200, 
                        {message: `Successfully fetched records from last ${seconds} seconds`,
                        records: result.rows},
                        `Requested from last ${seconds} seconds from ${ip}   Request: ${req.url}`);
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

