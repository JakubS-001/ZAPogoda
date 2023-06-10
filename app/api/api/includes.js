exports.RegUUID = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
exports.PERM_READ = 0b1;
exports.PERM_PUSH = 0b10;
exports.PERM_DELETE = 0b100;
exports.PERM_OVERWRITE = 0b1000;
const cols = [
    [
        "date",
        "TIMESTAMP(0)",
        "WITHOUT TIME ZONE NOT NULL PRIMARY KEY"
    ],
    [
        "temp",
        "REAL"
    ],
    [
        "humid",
       "REAL"
    ],
    [
        "wind_s",
        "REAL"
    ],
    [
        "wind_d",
        "REAL"
    ],
    [
        "pm25",
        "REAL"
    ],
    [
        "pm10",
        "REAL"
    ],
    [
        "co2",
        "REAL"
    ]
]; 

exports.wind_directions = [
    5, 3, 4, 7, 6, 9, 8, 1, 2, 11, 10, 15, 0, 13, 14, 12
]

exports.aunits = {
    days: "",
    hours: "30 minutes",
};

exports.cols = cols;
exports.colnames = cols.map(x => x[0]);

exports.checkPerms = function(perms, code) {
    return Boolean((perms & code) == code);
}

exports.send = function(res, status, ret, log) {
    res.status(status).json(ret);
    console.log(log);
}
