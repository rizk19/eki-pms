var express = require('express');
var router = express.Router();
var helpers = require('../helpers/util')
var nav = 2

const nodemailer = require("nodemailer");
// var moment = require('moment')

module.exports = (pool) => {
  /* GET home page. */
  // router.get('/', function (req, res, next) {
  //   res.render('index', { title: 'Express' });
  // });

  router.get('/', helpers.isLoggedIn, function (req, res, next) {
    res.render('login', { title: 'Login', loginMessage: req.flash('loginMessage') })
  })

  router.get('/login', function (req, res, next) {
    res.render('login', { title: 'Login', user: req.session.user, loginMessage: req.flash('loginMessage') })
  })

  router.get('/logout', function (req, res, next) {
    req.session.destroy(function (err) {
      // cannot access session here
      res.redirect('/login')
    })
  })

  router.post('/login', function (req, res, next) {
    pool.query('SELECT * FROM users WHERE email=$1 AND password=$2', [req.body.email, req.body.password], (err, response) => {
      if (response.rows.length > 0) {
        req.session.user = response.rows[0]
        res.redirect('/projects/list')
      } else {
        req.flash('loginMessage', 'User Email or Password is Wrong')
        res.redirect('login')
      }
    })
  })


  router.get('/forgotpassword', function (req, res, next) {
    res.render('forgotpassword', { title: 'Forgot Password', forgotMessage: req.flash('forgotMessage'), successMessage: req.flash('successMessage') })
  })


  router.post('/send', (req, res, next) => {
    let filterlogin = false

    pool.query(`SELECT email FROM users WHERE email = '${req.body.emailaccount}'`, (err, res0) => {
      let updatePass = ``
      if (res0.rows[0] == undefined) {
        req.flash('forgotMessage', 'Email Account not found.')
        res.redirect('forgotpassword')
      } else if (res0.rows[0]) {
        filterlogin = true
        updatePass = `UPDATE users SET password = floor(random() * 99999) WHERE email = '${req.body.emailaccount}'`
      }
      pool.query(updatePass, (err, res1) => {

        console.log(res0.rows[0]);
        pool.query(`SELECT email, password, CONCAT(firstname,' ',lastname) AS fullname FROM users WHERE email = '${req.body.emailaccount}'`, (err, res2) => {

          if (filterlogin) {
            const output = `
    <p> Hello Mr/Ms. ${res2.rows[0].fullname} <p>
    <p> You have a change on your User Password </p>
    <h4> Password change for this User : </h4>
    <ul>
      <li> Email: ${res2.rows[0].email} </li>
    </ul>
    <h4> Your Password has Change! </h4>
    <ul>
      <li> New Password : ${res2.rows[0].password} </li>
    </ul>
    <p> If you wanna change your Password by your own, try logging in with your user account and change it inside the app </p>
    <p> Enjoy It! </p>
    `
            let transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: 'reework.19@gmail.com',
                pass: 'r1zk1f4r1s'
              }
            });

            let mailOptions = {
              from: 'rizkiahf@gmail.com',
              to: `${req.body.emailaccount}`,
              subject: 'Project Management System by Eki: Password Change Request',
              text: 'Nodejs : User Password Change Request!',
              html: output
            };

            transporter.sendMail(mailOptions, (err, info) => {
              if (err) {

                return console.log(err);
              }
              console.log('Email sent: ' + info.response);
              console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
              req.flash('successMessage', 'Request has been sent!')
              res.redirect('forgotpassword')
            });
          }


        })
      })
    })
  })

  return router
}
// radenistri@gmail.com

// value="<%= query.email %>"
// value="<%= query.password %>"