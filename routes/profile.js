var express = require('express');
var router = express.Router();
var helpers = require('../helpers/util')
var nav = 2

module.exports = (pool) => {

    router.get('/list',helpers.isLoggedIn, function (req, res, next) {
        
        pool.query(`SELECT * FROM users WHERE email=$1`, [req.session.user.email], (err, response) => {
            let pro = response.rows[0]
            res.render('profile/list', { title: 'Projects', user: req.session.user, pro, nav })
        })
    })

    router.post('/list', (req, res, next) => {
        let filter = false
        let filterpass = req.body.password, filterposition = req.body.position, filterstatus = req.body.working_status;
        let filterResult = []
        
        let choosepro = `SELECT * FROM users WHERE userid='${req.session.user.userid}'`
        pool.query(choosepro, (err, rows) => {
            if (filterpass) {
                filterResult.push(`password='${filterpass}'`)
            }
            if (filterposition) {
                filter = true
                filterResult.push(`position='${filterposition}'`)
            }
            if (filterstatus) {
                filter = true
                filterResult.push(`working_status='${filterstatus}'`)
                console.log(filterstatus);

            }
            let allFilter = `UPDATE users`
            if (filter) {
                allFilter += ` SET ${filterResult.join(", ")} WHERE userid='${req.session.user.userid}'`
            }
            pool.query(allFilter, (err, response) => {
                res.redirect('/profile/list')

            })

        })
    })




    return router
}