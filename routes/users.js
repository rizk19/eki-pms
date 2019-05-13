var express = require('express');
var router = express.Router();
var helpers = require('../helpers/util')
var nav = 3

/* GET users listing. */
// router.get('/', function (req, res, next) {
//   res.send('respond with a resource');
// });

module.exports = (pool) => {


  router.get('/list',helpers.isLoggedIn, (req, res) => {

    const url = (req.url == '/list') ? `/list?page=1` : req.url
    const page = req.query.page || 1
    const limit = 3
    const offset = (page - 1) * limit
    let flaguser = false
    let filterUser = []

    if (req.query.checkuser1 && req.query.haluserid) {
      flaguser = true
      filterUser.push(`userid = ${req.query.haluserid}`)
    }
    if (req.query.checkuser2 && req.query.halusername) {
      flaguser = true
      filterUser.push(`CONCAT(firstname,' ',lastname) ILIKE '%${req.query.halusername}%'`)
    }
    if (req.query.checkuser3 && req.query.haluserposition) {
      flaguser = true
      filterUser.push(`position = '${req.query.haluserposition}'`)
    }
    if (req.query.checkuser4 && req.query.halworkingstat) {
      flaguser = true
      filterUser.push(`working_status = '${req.query.halworkingstat}'`)
    }

    let countUser = `SELECT COUNT(userid) as total FROM users`
    if (flaguser) {
      countUser += ` WHERE ${filterUser.join(" AND ")} AND privilage = 'false'`
    }

    pool.query(countUser, (err, count) => {

      const total = count.rows[0].total
      let pages = Math.ceil(total / limit)


      let baseuser = `SELECT userid, position, CONCAT(firstname,' ',lastname) AS fullname, working_status FROM users`
      if (flaguser) {
        baseuser += ` WHERE ${filterUser.join(" AND ")} AND privilage = 'false'`
      }
      baseuser += ` ORDER BY userid LIMIT ${limit} OFFSET ${offset}`
      pool.query(baseuser, (err, res1) => {
        let showuser1 = res1.rows

        res.render('users/list', {
          title: 'Projects', user: req.session.user, query: req.query, nav, showuser1, pagination: { page, pages, url }
        })
      })
    })
  })

  router.get('/add',helpers.isLoggedIn, function (req, res, next) {
    res.render('users/add', {
      title: 'Add Users', nav, user: req.session.user
    })
  })

  router.post('/add', function (req, res, next) {

    let newUser = `INSERT INTO users(firstname, lastname, email, password, position, working_status) VALUES ('${req.body.newFirstname}','${req.body.newLastname}','${req.body.newEmail}','${req.body.newPass}','${req.body.position}','${req.body.workingStatus}')`

    pool.query(newUser, (err, result1) => {
      console.log(newUser)
      console.log(result1);
      res.redirect('/users/list')
    })
  })

  router.get('/edit/:userid',helpers.isLoggedIn, (req, res) => {
    let keyid = req.params.userid

    pool.query(`SELECT * FROM users WHERE userid = ${keyid}`, (err, resEdit1) => {

      let showEdit = resEdit1.rows[0]

      res.render('users/edit', {
        title: 'edit project', user: req.session.user, query: req.query, nav, keyid, showEdit
      })
    })
  })

  router.post('/edit/:userid', (req, res) => {
    let editUser = req.params.userid
    let editing = `UPDATE users SET firstname='${req.body.editFirstname}', lastname='${req.body.editLastname}', email='${req.body.editEmail}', password='${req.body.editPass}', position='${req.body.editPosition}', working_status='${req.body.editStatus}' WHERE userid = ${editUser}`

    pool.query(editing, (err, resEdit2) => {

      res.redirect('/users/list')
    })
  })

  router.get('/delete/:userid',helpers.isLoggedIn, (req, res) => {
    let delUser = req.params.userid
    let doDelete = `DELETE FROM users WHERE userid = ${delUser}`

    pool.query(doDelete, (err, resDel) => {
  
      res.redirect(`/users/list`)
    })
  })

  return router
}
