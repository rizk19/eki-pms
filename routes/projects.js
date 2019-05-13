var express = require('express');
var router = express.Router();
var helpers = require('../helpers/util')
var nav = 1

var moment = require('moment')
module.exports = (pool) => {

    router.get('/list',helpers.isLoggedIn, function (req, res, next) {
        
        let filter = false
        let filterResult = []
        //form
        let idquerypro = Number(req.query.halprojectid), namequerypro = req.query.halprojectname, memberquerypro = req.query.halprojectmember
        //checkbox
        let cp1 = req.query.checkpro1, cp2 = req.query.checkpro2, cp3 = req.query.checkpro3;

        const url = (req.url == '/list') ? `/list?page=1` : req.url
   
        const page = req.query.page || 1;
        const limit = 2;
        const offset = (page - 1) * limit

        if (cp1 && idquerypro) {
            filter = true;
            filterResult.push(`projects.projectid = ${idquerypro}`)
        }
        if (cp2 && namequerypro) {
            filter = true;
            filterResult.push(`projects.name ILIKE '%${namequerypro}%'`)
        }
        if (cp3 && memberquerypro) {
            filter = true;
            filterResult.push(`CONCAT(users.firstname,' ',users.lastname) LIKE '${memberquerypro}'`)
        }
        //counting data
        let sql = `SELECT COUNT(id) as total FROM (SELECT DISTINCT projects.projectid AS id FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON members.userid = users.userid`
        if (filter) {
            sql += ` WHERE ${filterResult.join(" AND ")}`
        }
        sql += `) AS project_member`

        pool.query(sql, (err, count) => {
            const total = count.rows[0].total
            const pages = Math.ceil(total / limit)

            //menampilkan data dari projects
            sql = `SELECT DISTINCT projects.projectid, projects.name FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid`
            if (filter) {
                sql += ` WHERE ${filterResult.join(" AND ")}`
            }
            sql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

            //membatasi query member berdasarkan project yang akan diolah saja
            let newsql = `SELECT DISTINCT projects.projectid FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON members.userid = users.userid`
            if (filter) {
                newsql += ` WHERE ${filterResult.join(" AND ")}`
            }
            newsql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

            let processing = `SELECT projects.projectid, CONCAT (users.firstname,' ',users.lastname) AS fullname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid
            WHERE projects.projectid IN (${newsql})`

            pool.query(sql, (err, projectData) => {
                pool.query(processing, (err, memberData) => {

                    projectData.rows.map(project => {
                        project.members = memberData.rows.filter(member => { return member.projectid == project.projectid }).map(item => item.fullname)
                    })

                    pool.query(`SELECT projectoption FROM users WHERE userid = ${req.session.user.userid}`, (err, rowss) => {

                        pool.query(`SELECT CONCAT (firstname,' ',lastname) AS fullname FROM users`, (err, usersData) => {
                           

                            res.render('projects/list', {
                                title: 'Projects', data:projectData.rows, users:usersData.rows, nav, user: req.session.user, pagination: {
                                    page, pages, total, url
                                },query: req.query, projectoption: JSON.parse(rowss.rows[0].projectoption)
                            })
                        })
                    })
                })
            })
        })
    })

    router.post('/projectoptions', helpers.isLoggedIn, (req, res) => {

        let sql = `UPDATE users SET projectoption = '${JSON.stringify(req.body)}' WHERE userid = ${req.session.user.userid}`

        pool.query(sql, (err, rows) => {

            res.redirect('/projects/list')
        })
    })

    router.get('/add',helpers.isLoggedIn, function (req, res, next) {

        pool.query(`SELECT firstname, lastname FROM users ORDER BY userid`, (err, response) => {
            function fullName(getname) {
                let fullname = [getname.firstname, getname.lastname].join(" ")
                return fullname
            }
            const pro = response.rows.map(fullName)

            res.render('projects/add', {
                title: 'Projects', pro,user: req.session.user, nav, response: response.rows
            })
        })
    })

    router.post('/add', function (req, res, next) {
        let trynew = `SELECT nextval('projects_projectid_seq') AS nextid`
        pool.query(trynew, (err, data) => {
            const projectid = data.rows[0].nextid

            trynew = `INSERT INTO projects(projectid, name) VALUES ('${projectid}','${req.body.addproject}')`

            pool.query(trynew, (err, response) => {
                if (err) return res.send(err)

                if (typeof req.body.membersck == 'string') {
                    trynew = `INSERT INTO members (projectid, userid) VALUES (${projectid}, ${req.body.membersck})`
                } else {
                    trynew = `INSERT INTO members (projectid, userid) VALUES ${req.body.membersck.map((item) => `(${projectid},${item})`).join(',')}`
                }
                pool.query(trynew, (err) => {
                    pool.query(`UPDATE members SET role = subquery.position FROM (SELECT userid, position FROM users) AS subquery WHERE members.userid = subquery.userid`)
                    if (err) return res.send(err)
                    res.redirect('/projects/list')
                })
            })
        })
    })
    router.get('/edit/:id',helpers.isLoggedIn, (req, res) => {
        

        pool.query(`SELECT * FROM users ORDER BY userid`, (err, response) => {

            function fullName(getname) {
                let fullname = [getname.firstname, getname.lastname].join(" ")
                return fullname
            }
            let editPro = response.rows.map(fullName)
            pool.query(`SELECT * FROM projects WHERE projectid = ${req.params.id}`, (err, response2) => {
                let projectname = response2.rows[0].name
                // console.log(response2.rows[0].name);

                res.render('projects/edit', {
                    title: 'Edit Projects', nav, editPro, projectname,user: req.session.user, response: response.rows
                })
            })
        })
    })
    router.post('/edit/:id',helpers.isLoggedIn, (req, res) => {
        let editId = req.params.id

        let postEdit = `UPDATE projects SET projectid = ${editId}, userid = '${req.body.editproject}'`

        pool.query(postEdit, (err, response) => {

            pool.query(`DELETE FROM members WHERE projectid = ${editId}`, (err, raw) => {

                if (typeof req.body.editmemberproject == 'string') {
                    postEdit = `INSERT INTO members (projectid, userid) VALUES (${editId}, ${req.body.editmemberproject})`
                } else {
                    postEdit = `INSERT INTO members (projectid, userid) VALUES ${req.body.editmemberproject.map((item) => `(${editId},${item})`).join(',')}`
                }

                pool.query(postEdit, (err) => {
                    pool.query(`UPDATE members SET role = subquery.position FROM (SELECT userid, position FROM users) AS subquery WHERE members.userid = subquery.userid`)
                    if (err) return res.send(err)
                    res.redirect('/projects/list')
                })
            })
        })
    })
    router.get('/delete/:id',helpers.isLoggedIn, (req, res) => {
        pool.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, (err, resdel) => {
            pool.query(`DELETE FROM projects WHERE projectid = ${req.params.id}`, (err, resdel2) => {
                console.log(resdel2);
                if (err) {
                    console.log(err);
                } else {
                    res.redirect(`/projects/list`)
                }
            })
        })
    })
    router.get('/overview/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 2
        let keyid = req.params.id

        let showmember = `SELECT firstname, lastname FROM members INNER JOIN users ON members.userid = users.userid WHERE projectid = ${keyid} ORDER BY users.userid`

        pool.query(showmember, (err, response) => {
            let showedmember = response.rows
            //issue tracking
            //bug
            let issueBug = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Bug'`
            pool.query(issueBug, (err, resBug) => {
                let countBug = resBug.rows[0].count
                let issueBugClosed = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Bug' AND status != 'Closed'`
                pool.query(issueBugClosed, (err, resBug2) => {
                    let countBug2 = resBug2.rows[0].count
                    //feature
                    let issueFeature = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Feature'`
                    pool.query(issueFeature, (err, resFeature) => {
                        let countFeat = resFeature.rows[0].count
                        let issueFeatureClosed = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Feature' AND status != 'Closed'`
                        pool.query(issueFeatureClosed, (err, resFeature2) => {
                            let countFeat2 = resFeature2.rows[0].count
                            //support
                            let issueSupp = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Support'`
                            pool.query(issueSupp, (err, resSupp) => {
                                let countSupp = resSupp.rows[0].count
                                let issueSuppClosed = `SELECT COUNT(*) FROM issues WHERE projectid = ${keyid} AND tracker = 'Support' AND status != 'Closed'`
                                pool.query(issueSuppClosed, (err, resSupp2) => {
                                    let countSupp2 = resSupp2.rows[0].count

                                    res.render('projects/overview', { title: 'Login', nav, nav1, keyid, showedmember,user: req.session.user, countBug, countBug2, countFeat, countFeat2, countSupp, countSupp2 })
                                })
                            })
                        })
                    })
                })
            })
        })
    })

    router.get('/members/list/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 3
        let keyid = req.params.id

        const web = (req.url == `/members/list/${keyid}`) ? `/members/list/${keyid}?page=1` : req.url
        
        // req.query.page ? req.url : `/members/list/${keyid}/?page=1`
        let flagmember = false
        let filterMember = []
        //form
        let idquerymem = Number(req.query.halmemberid), namequerymem = req.query.halmembername
        //checkbox
        let cm1 = req.query.checkmem1, cm2 = req.query.checkmem2, cm3 = req.query.checkmem3;

        let page = req.query.page || 1;
        let limit = 2;
        let offset = (page - 1) * limit

        if (cm1 && idquerymem) {
            flagmember = true;
            filterMember.push(`users.userid = ${idquerymem}`)
        }
        if (cm2 && namequerymem) {
            flagmember = true;
            filterMember.push(`firstname ILIKE '%${namequerymem}%' `)
        }
        if (cm3 && req.query.positionmem) {
            flagmember = true;
            filterMember.push(`role = '${req.query.positionmem}' `)
        }

        let sql = `SELECT COUNT(*) as total FROM members INNER JOIN users ON users.userid = members.userid WHERE projectid = ${keyid}`
        if (flagmember) {
            sql += ` AND ${filterMember.join(" AND ")}`
        }


        pool.query(sql, (err, response0) => {

            let total = response0.rows[0].total
            let pages = Math.ceil(total / limit)


            sql = `SELECT * FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid WHERE members.projectid = ${keyid}`
            if (flagmember) {
                sql += ` AND ${filterMember.join(" AND ")}`
            }
            sql += ` ORDER BY users.userid LIMIT ${limit} OFFSET ${offset}`

            pool.query(sql, (err, response1) => {

                let listable = response1.rows

                pool.query(`SELECT memberoption FROM users WHERE userid = ${req.session.user.userid}`, (err, rowss) => {


                    res.render('projects/members/list', {
                        title: 'Login', nav, nav1, keyid,user: req.session.user, listable, query: req.query, memberoption: JSON.parse(rowss.rows[0].memberoption), pagination: {
                            page, pages, web
                        }
                    })
                })
            })
        })
    })
    router.post('/members/list/:id', (req, res) => {

        let sql = `UPDATE users SET memberoption = '${JSON.stringify(req.body)}' WHERE userid = ${req.session.user.userid}`

        pool.query(sql, (err, rows) => {

            res.redirect(`/projects/members/list/${req.params.id}`)
        })
    })


    router.get('/members/list/add/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 3
        let keyid = req.params.id

        pool.query(`SELECT userid, firstname, lastname FROM users WHERE userid NOT IN (SELECT userid FROM members WHERE members.projectid = ${keyid})`, (err, response) => {
            let membernumber = response.rows

            function fullMember(getmember) {
                var fullmember = [getmember.firstname, getmember.lastname].join(" ")
                return fullmember
            }
            let plusmember = response.rows.map(fullMember)

            let jobdesk = `SELECT DISTINCT position FROM users`
            pool.query(jobdesk, (err, response1) => {
                let joblist = response1.rows[0]

                res.render(`projects/members/add`, {
                    title: 'Projects', nav, nav1,user: req.session.user, plusmember, joblist, keyid, membernumber
                })
            })
        })
    })

    router.post('/members/list/add/:id', (req, res) => {
        let keyid = req.params.id

        let addingmember = `INSERT INTO members(userid, role , projectid) SELECT ${req.body.namemember}, '${req.body.memberPosition}', projectid FROM projects WHERE projectid = ${keyid}`

        pool.query(addingmember, (err, response2) => {

            res.redirect(`/projects/members/list/${req.params.id}`)
        })
    })

    router.get('/members/list/delete/:id/:userid',helpers.isLoggedIn, (req, res) => {
        let useriddel = req.params.userid
        let projectiddel = req.params.id


        pool.query(`DELETE FROM members WHERE userid=${useriddel} AND projectid =${projectiddel}`, (err) => {
            if (err) {
                console.log(err);
            } else {
                res.redirect(`/projects/members/list/${projectiddel}`)
            }
        })
    })

    router.get('/members/list/edit/:id/:userid',helpers.isLoggedIn, (req, res) => {

        let nav1 = 3
        let keyid = Number(req.params.id)
        let userkeyid = req.params.userid

        pool.query(`SELECT users.userid, role, firstname, lastname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON members.projectid = projects.projectid WHERE members.projectid = ${keyid} AND users.userid = ${userkeyid}`, (err, response) => {

            let memberedit = response.rows

            function fullMember(getmember) {
                var fullmember = [getmember.firstname, getmember.lastname].join(" ")
                return fullmember
            }
            let plusmember = response.rows.map(fullMember)

            res.render(`projects/members/edit`, {
                title: 'Projects', nav, nav1,user: req.session.user, plusmember, keyid, memberedit, userkeyid
            })
        })
    })

    router.post('/members/list/edit/:id/:userid', (req, res, next) => {
        let memedit = req.body.memberPosition

        let editrole = `UPDATE members SET role = '${memedit}' WHERE userid = ${req.params.userid}`

        pool.query(editrole, (err, response) => {

            res.redirect(`/projects/members/list/${req.params.id}`)
        })
    })


    router.get('/issues/list/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 4
        let keyid = req.params.id

        const web1 = (req.url == `/issues/list/${keyid}`) ? `/issues/list/${keyid}?page=1` : req.url

        let flagissue = false
        let filterIssue = []
        //checkbox
        let ci1 = req.query.checkfilterissue1, ci2 = req.query.checkfilterissue2, ci3 = req.query.checkfilterissue3;
        //form
        let IdIssue = Number(req.query.halissueid), nameIssue = req.query.halissuename;

        let page = req.query.page || 1;
        let limit = 2;
        let offset = (page - 1) * limit;

        if (ci1 && IdIssue) {
            flagissue = true
            filterIssue.push(`issueid = ${IdIssue}`)
        }
        if (ci2 && nameIssue) {
            flagissue = true
            filterIssue.push(`subject ILIKE '%${nameIssue}%'`)
        }
        if (ci3 && req.query.halissuetracker) {
            flagissue = true
            filterIssue.push(`tracker = '${req.query.halissuetracker}'`)
        }

        let issuetable = `SELECT COUNT(*) as total FROM issues INNER JOIN users ON users.userid = assignee WHERE projectid = ${keyid}`
        if (flagissue) {
            issuetable += ` AND ${filterIssue.join(" AND ")}`
        }

        pool.query(issuetable, (err, resIssueFilter) => {
            let total = resIssueFilter.rows[0].total
            let pages = Math.ceil(total / limit)

            issuetable = `SELECT * from issues INNER JOIN projects ON projects.projectid = issues.projectid INNER JOIN users ON users.userid = issues.assignee WHERE issues.projectid = ${keyid}`
            if (flagissue) {
                issuetable += ` AND ${filterIssue.join(" AND ")}`
            }
            issuetable += ` ORDER BY issueid LIMIT ${limit} OFFSET ${offset}`


            pool.query(issuetable, (err, resIssue1) => {
                let issuesTableResult = resIssue1.rows

                pool.query(`SELECT issuesoption FROM users WHERE userid = ${req.session.user.userid}`, (err, rowss) => {

                    res.render('projects/issues/list', {
                        title: 'Login', nav, nav1, keyid, query: req.query, issuesTableResult, moment, issuesoption: JSON.parse(rowss.rows[0].issuesoption),user: req.session.user, pagination: {
                            page, pages, web1
                        }
                    })
                })
            })
        })
    })

    router.post('/issues/list/:id', (req, res) => {

        let sql = `UPDATE users SET issuesoption = '${JSON.stringify(req.body)}' WHERE userid = ${req.session.user.userid}`

        pool.query(sql, (err, rows) => {

            res.redirect(`/projects/issues/list/${req.params.id}`)
        })
    })


    router.get('/issues/list/add/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 4
        let keyid = req.params.id

        pool.query(`SELECT * FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid WHERE members.projectid = ${keyid}`, (err, responseAdd) => {

            let resultAdd = responseAdd.rows

            res.render(`projects/issues/add`, {
                title: 'Projects', nav, nav1, keyid, user: req.session.user,resultAdd, moment
            })
        })

    })

    router.post('/issues/list/add/:id', (req, res) => {
        let keyid = req.params.id

        let sampleFile = req.files.sampleFile;

        let uploadPath = `/home/rishiki/PMS Fam/pms-project/public/images/` + sampleFile.name;

        sampleFile.mv(uploadPath, function (err) {
            if (err) {
                return res.status(500).send(err);
            }
        })

        let insertAdd = `INSERT INTO issues(tracker, subject, description, status, priority, assignee,startdate, duedate, estimatedtime, done, files, parenttask, author, projectid, crateddate) VALUES ('${req.body.trackerissue}', '${req.body.subjectform}', '${req.body.descriptionform}', '${req.body.statusIssue}', '${req.body.priorityissue}', ${req.body.assigneeform}, '${req.body.startdateform}', '${req.body.duedateform}', ${req.body.estimatedform}, ${req.body.doneform}, '${req.files.sampleFile.name}', ${req.body.parentadd}, ${req.body.authoradd}, ${req.params.id}, '${moment().format('YYYY-MM-DD hh:mm:ss')}')`

        pool.query(insertAdd, (err, responseAdd) => {

            pool.query(`INSERT INTO activity(title, description, author, time) VALUES (('${req.body.subjectform}''#${req.params.id}''${req.body.statusIssue}'), '${req.body.descriptionform}', ${req.body.authoradd}, '${moment().format('YYYY-MM-DD hh:mm:ss')}')`, (err, responseAct) => {

                res.redirect(`/projects/issues/list/${req.params.id}`)

            })
        })
    })

    router.get('/issues/list/edit/:id/:issueid',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 4
        let keyid = req.params.id
        let userkeyid = req.params.issueid

        pool.query(`SELECT * FROM issues INNER JOIN users ON users.userid = author WHERE issues.projectid = ${keyid} AND issueid = ${userkeyid}`, (err, responseEdit) => {

            let resultEdit = responseEdit.rows[0]

            pool.query(`SELECT * FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid WHERE members.projectid = ${keyid}`, (err, responseEdit2) => {

                let resultEdit2 = responseEdit2.rows


                res.render(`projects/issues/edit`, {
                    title: 'Projects', nav, nav1, keyid, user: req.session.user,resultEdit, resultEdit2, moment
                })
            })
        })
    })

    router.post('/issues/list/edit/:id/:issueid', (req, res, next) => {
        let keyid = req.params.id
        let userkeyid = req.params.issueid
        let flagedit = false

        let issueEdit = `UPDATE issues SET tracker='${req.body.trackerissueEdit}', subject='${req.body.subjectformEdit}', description='${req.body.descriptionformEdit}', status='${req.body.statusIssueEdit}', priority='${req.body.priorityissueEdit}', assignee=${req.body.assigneeformEdit}, startdate='${req.body.startdateformEdit}', duedate='${req.body.duedateformEdit}', estimatedtime=${req.body.estimatedformEdit}, done=${req.body.doneformEdit}, targetversion='${req.body.targetversionform}', parenttask=${req.body.parenttaskform}, updatedate='${moment().format('YYYY-MM-DD hh:mm:ss')}'`
        if (req.body.spenttimeform) {
            flagedit = true
            issueEdit += `, spenttime=${req.body.spenttimeform}`
        }
        if (req.body.statusIssueEdit == 'Closed') {
            flagedit = true
            issueEdit += `, closeddate='${moment().format('YYYY-MM-DD hh:mm:ss')}'`
        }
        issueEdit += ` WHERE projectid=${req.params.id} AND issueid=${req.params.issueid}`

        pool.query(issueEdit, (err, issueEditResult) => {


            pool.query(`INSERT INTO activity(title, description, author, time) VALUES (('${req.body.subjectformEdit}''#${req.params.id}''${req.body.statusIssueEdit}'), '${req.body.descriptionformEdit}', ${req.session.user.userid}, '${moment().format('YYYY-MM-DD hh:mm:ss')}')`, (err, issueEditResult2) => {

                res.redirect(`/projects/issues/list/${req.params.id}`)
            })
        })
    })

    router.get('/issues/list/delete/:id/:issueid',helpers.isLoggedIn, (req, res) => {
        let issueiddel = req.params.issueid
        let projectiddel = req.params.id

        pool.query(`DELETE FROM issues WHERE issueid=${issueiddel} AND projectid =${projectiddel}`, (err) => {
            if (err) {
                console.log(err);
            } else {
                res.redirect(`/projects/issues/list/${projectiddel}`)
            }
        })
    })

    router.get('/activity/:id',helpers.isLoggedIn, function (req, res, next) {
        let nav1 = 7
        let keyid = req.params.id

        let showAct = `SELECT * from activity INNER JOIN users ON users.userid = author ORDER BY activityid desc`
        pool.query(showAct, (err, resAct) => {
            let throwAct = resAct.rows

            console.log(moment().subtract(2, 'days').format('YYYY/MM/DD'));

            res.render('projects/activity', {
                title: 'Activity', nav, nav1, user: req.session.user, keyid, moment, throwAct
            })
        })
    })

    // 
    //     



    return router
}

// pool.query(`SELECT firstname, lastname FROM users ORDER BY userid`, (err, response) => {
//     function fullName(getname) {
//         var fullname = [getname.firstname, getname.lastname].join(" ")
//         return fullname
//     }
//     const pro = response.rows.map(fullName)
// })


// pms - ardw
// projects.projectid, projects.name, firstname, lastname

// `SELECT projects.name, firstname, lastname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid ORDER BY projects.projectid`

// SELECT projects.name, COUNT(firstname) as fullname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid GROUP BY projects.name


// pool.query(getmember, (err, res) => {
    // function fullName(getname) {
    //     var fullname = [getname.firstname, getname.lastname].join(" ")
    //     return fullname
    // }
    // const hasil2 = res.rows.map(fullName)
// })


// <% for (i = 0; i <= hasil2.length; i++ ){ %>
//     <div class="custom-control custom-checkbox my-1 mr-sm-2">
//         <input class="custom-control-input" type="checkbox" name="membersck" id="checkbox<% i %>"
//             value="<%hasil2[i]%>">
//         <label class="custom-control-label" for="checkbox<% i %>">
//             <%hasil2[i]%>
//         </label>
//     </div>
//     <% } %>

// <%= projectoption.idcheckbox ? 'checked' : '' %>
// <%= projectoption.namecheckbox ? 'checked' : '' %>
// <%= projectoption.memberscheckbox ? 'checked' : '' %>

// let addingmember = `INSERT INTO members(userid, role , projectid) SELECT ${req.body.namemember}, ${req.body.memberPosition}, projectid FROM projects WHERE projectid = ${req.params.id}`

// INSERT INTO issues(tracker, subject, description, status, priority, assignee,startdate, duedate, estimatedtime, done, files, parenttask, author, projectid) VALUES ('${addTracker}', '${addSubject}', '${addDesc}', '${addStat}', '${addPrior}', ${addAssignee}, '${addStartDate}', '${addDueDate}', ${addEstimated}, ${addDone}, '${addFile}', ${parentAdd}, ${authorAdd}, ${keyid}



// let filter = false
//         let filterResult = []
//         //form
//         let idquerypro = Number(req.query.halprojectid), namequerypro = req.query.halprojectname, memberquerypro = req.query.halprojectmember
//         //checkbox
//         let cp1 = req.query.checkpro1, cp2 = req.query.checkpro2, cp3 = req.query.checkpro3;

//         const page = req.query.page || 1;
//         const limit = 50;
//         const offset = (page - 1) * limit

//         if (cp1 && idquerypro) {
//             filter = true;
//             filterResult.push(`projects.projectid = ${idquerypro}`)
//         }
//         if (cp2 && namequerypro) {
//             filter = true;
//             filterResult.push(`projects.name ILIKE '%${namequerypro}%'`)
//         }
//         if (cp3 && memberquerypro) {
//             filter = true;
//             filterResult.push(`CONCAT(users.firstname,' ',users.lastname) LIKE '${memberquerypro}'`)
//         }
//         //counting data
//         let sql = `SELECT COUNT(id) as total FROM (SELECT DISTINCT projects.projectid AS id FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON members.userid = users.userid`
//         if (filter) {
//             sql += ` WHERE ${filterResult.join(" AND ")}`
//         }
//         sql += `) AS project_member`

//         pool.query(sql, (err, count) => {
//             const total = count.rows[0].total
//             const pages = Math.ceil(total / limit)

//             //menampilkan data dari projects
//             sql = `SELECT DISTINCT projects.projectid, projects.name FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON users.userid = members.userid`
//             if (filter) {
//                 sql += ` WHERE ${filterResult.join(" AND ")}`
//             }
//             sql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

//             //membatasi query member berdasarkan project yang akan diolah saja
//             let newsql = `SELECT DISTINCT projects.projectid FROM projects LEFT JOIN members ON projects.projectid = members.projectid LEFT JOIN users ON members.userid = users.userid`
//             if (filter) {
//                 newsql += ` WHERE ${filterResult.join(" AND ")}`
//             }
//             newsql += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

//             let processing = `SELECT projects.projectid, CONCAT (users.firstname,' ',users.lastname) AS fullname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid
//             WHERE projects.projectid IN (${newsql})`

//             pool.query(sql,(err, projectData)=>{
//                 pool.query(processing,(err, memberData)=>{

//                     projectData.rows.map(project => {
//                         project.members = memberData.rows.filter(member => { return member.projectid == project.projectid })
//                     })
//                 })
//             })


// let filter = false
// let filterResult = []
// //form
// let idquerypro = Number(req.query.halprojectid), namequerypro = req.query.halprojectname, memberquerypro = req.query.halprojectmember
// //checkbox
// let cp1 = req.query.checkpro1, cp2 = req.query.checkpro2, cp3 = req.query.checkpro3;

// const page = req.query.page || 1;
// const limit = 50;
// const offset = (page - 1) * limit

// if (cp1 && idquerypro) {
//     filter = true;
//     filterResult.push(`projectid = ${idquerypro}`)
// }
// if (cp2 && namequerypro) {
//     filter = true;
//     filterResult.push(`name ILIKE '%${namequerypro}%'`)
// }
// if (cp3 && halprojectmember) {
//     filter = true;
//     filterResult.push(`CONCAT(users.firstname,' ',users.lastname) ILIKE '%${memberquerypro}%'`)
// }

// let sql = `SELECT COUNT(*) as total FROM members`
// if (filter) {
//     sql += ` WHERE ${filterResult.join(" AND ")}`
// }

// pool.query(sql, (err, count) => {
//     const total = count.rows[0].total
//     const pages = Math.ceil(total / limit)

//     let processing = `SELECT * FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid`

//     if (filter) {
//         processing += ` WHERE ${filterResult.join(" AND ")}`
//     }
//     processing += ` ORDER BY projects.projectid LIMIT ${limit} OFFSET ${offset}`

//     // sql += ` ORDER BY projectid LIMIT ${limit} OFFSET ${offset}`
//     // console.log(sql);


//     // let processing = `SELECT * FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid ORDER BY projectid`

//     pool.query(processing, (err, response) => {
//         const processed = response.rows

//         let tryone = `SELECT projects.name, firstname, lastname FROM members INNER JOIN users ON users.userid = members.userid INNER JOIN projects ON projects.projectid = members.projectid ORDER BY projects.projectid asc`

//         pool.query(tryone, (err, result) => {
//             // let trythree = result.rows
//             for (i = 0; i < result.rows.length; i++) {
//                 let trytwo = result.rows[i]
//                 // console.log(trytwo);
//                 // console.log(trytwo);
//             }

//             function getFullName(coba) {
//                 var fullname = [coba.firstname, coba.lastname].join(" ")
//                 return fullname
//             }
//             let hasil = result.rows.map(getFullName)
//             // console.log(hasil);


//             pool.query(`SELECT nextval ('projects_projectid_seq') AS nextid`, (err, data) => {
//                 let projectid1 = data.rows[0].nextid
//                 console.log(projectid1);

//                 // function getName(coba) {
//                 //     var name = [coba.name].join("")
//                 //     return name
//                 // }
//                 // console.log(result.rows.map[getName]);

//                 pool.query(`SELECT projectoption FROM users WHERE userid = ${req.session.user.userid}`, (err, rowss) => {

//                     res.render('projects/list', {
//                         title: 'Projects', processed, hasil, nav, hasil, pagination: {
//                             page, pages
//                         }, projectoption: JSON.parse(rowss.rows[0].projectoption)
//                     })
//                 })
//             })
//         })
//     })
// })
// })