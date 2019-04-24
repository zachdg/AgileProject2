const MongoClient = require('mongodb').MongoClient;
const utils = require('./server_utils/mongo_util.js');
const express = require('express');
const session = require('express-session');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const url = require('url');
const fs = require('fs');
const expressValidator = require('express-validator');
const cookieParser = require('cookie-parser');
var ObjectId = require('mongodb').ObjectID;
var app = express();

app.use(session({ secret: 'krunal', resave: false, saveUninitialized: true }));
app.use(expressValidator());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

var port = process.env.PORT || 8080;

//Needed to use partials folder
hbs.registerPartials(__dirname + '/views/partials');

//Helpers
hbs.registerHelper('getCurrentYear', () => {
    return new Date().getFullYear();
});


//Helpers End


app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/views'));


app.get('/', (request, response) => {
    app.locals.user = false;
    var username = "";
    if (fs.existsSync("./user_info.json")) {
        var user_info = JSON.parse(fs.readFileSync('user_info.json'));
        app.locals.user = true;
        username = user_info.username
    }

    response.render('home.hbs', {
        title: "AJZ Shoe shop",
        message: "Welcome to AJZ Shoe shop",
        username: username
    })
});

app.get('/my_cart', (request, response) => {
    app.locals.user = false;
    var user_id = "";
    var username = '';
    if (fs.existsSync("./user_info.json")) {
        var user_info = JSON.parse(fs.readFileSync('user_info.json'));
        app.locals.user = true;
        user_id = user_info.id;
        username = user_info.username;
    }
    var db = utils.getDb();

    db.collection('Cart_' + user_id).find({}).toArray((err, docs) => {
        if (err) {
            response.render('404.hbs', {
                error: "Cannot connect to database"
            })
        }
        var cart_list = [];
        for (var i = 0; i < docs.length; i += 1) {
            cart_list.push(docs.slice(i, i + 1));
        }
        response.render('my_cart', {
            products: cart_list,
            username: username

        })
    });
});

//
//Shop page


app.get('/shop', (request, response) => {
    app.locals.user = false;
    var username = "";
    if (fs.existsSync("./user_info.json")) {
        var user_info = JSON.parse(fs.readFileSync('user_info.json'));
        app.locals.user = true;
        username = user_info.username
    }
    var db = utils.getDb();
    db.collection('Shoes').find({}).toArray((err, docs) => {
        if (err) {
            response.render('404', { error: "Unable to connect to database" })
        }

        if (!docs) {
            throw err;
        } else {
            var productChunks = [];
            var chunkSize = 3;
            for (var i = 0; i < docs.length; i += chunkSize) {
                productChunks.push(docs.slice(i, i + chunkSize));
            }
            response.render('shop.hbs', {
                products: productChunks,
                username: username
            })
        }

    });
});

//
//Shop page end

app.get('/login', (request, response) => {
    response.render('login.hbs', { errors: request.session.errors });
    request.session.errors = null;
});

app.get('/insert', (request, response) => {
    response.render('sign_up.hbs', {
        message: null,
        // csrfToken: request.csrfToken
    })
});

app.get('/logout', (request, response) => {
    app.locals.user = false;
    fs.unlink('user_info.json', function(err) {
        if (err) throw err;
    });

    response.redirect('/')
});


//mongoDB

app.post('/insert', function(request, response) {

    var email = request.body.email;
    var pwd = request.body.pwd;
    var pwd2 = request.body.pwd2;


    request.checkBody('email', 'Email is required').notEmpty();
    request.checkBody('email', 'Please enter a valid email').isEmail();
    request.checkBody('pwd', 'Password is required').notEmpty();
    request.checkBody('pwd2', 'Please type your password again').notEmpty();



    const errors = request.validationErrors();
    var error_msg = [];
    if (errors) {
        for (var i = 0; i < errors.length; i++) {
            error_msg.push(errors[i].msg);
        }
    }

    var db = utils.getDb();
    db.collection('Accounts').findOne({ email: email }, function(err, user) {
        if (err) {
            response.render('404.hbs')
        }
        if (user) {
            error_msg.push("Account already exists, Try again.");
            response.render('sign_up.hbs', {
                error: error_msg
            })

        } else {
            if (email === "") {
                response.render('sign_up.hbs', {
                    error: error_msg
                })
            } else if (pwd === pwd2) {
                db.collection('Accounts').insertOne({
                    email: email,
                    pwd: pwd
                }, (err, result) => {
                    if (err) {
                        response.send('Unable to create account');
                    }
                    response.render('sign_up.hbs', {
                        message: `Account ${email} created`
                    })
                });
            } else {
                error_msg.push('Password does not match');
                response.render('sign_up.hbs', {
                    message: error_msg
                })
            }
        }
    })
});

app.post('/insert_login', (request, response) => {
    var email = request.body.email;
    var pwd = request.body.pwd;

    var db = utils.getDb();
    db.collection('Accounts').findOne({ email: email }, function(err, user) {
        if (err) {
            response.render('404.hbs', { error: "Could not connect to database" })
        }

        if (!user) {
            response.render('login.hbs', {
                message: 'Account does not exist'
            })
        } else if (user && user.email != '') {
            if (pwd == user.pwd) {
                response.redirect('/');
                user_info = {
                    username: user.email,
                    id: user._id,
                    cart: []
                };
                fs.writeFileSync('user_info.json', JSON.stringify(user_info, undefined, 2));
            } else {
                response.render('login.hbs', {
                    message: 'Incorrect password',
                    email: user.email
                });
            }
        } else if (email == '') {
            response.render('login.hbs', {
                message: 'E-mail can\'t be blank'
            });

        } else {
            response.render('login.hbs', {
                message: 'Invalid email or password'
            });
        }
    });
});


app.get('/404', (request, response) => {
    response.render('404', {
        error: "Cannot connect to the server."
    })
});


//Route to add to cart

app.post('/add-to-cart', (request, response) => {
    //read from user_info to get _id,
    app.locals.user = false;
    if (fs.existsSync("./user_info.json")) {
        var user_info = JSON.parse(fs.readFileSync('user_info.json'));
        app.locals.user = true;
        var id = user_info.id
    }

    var db = utils.getDb();
    var userID = id;
    var productId = request.body.objectid;

    db.collection('Shoes').findOne({ _id: ObjectId(productId) }, (err, doc) => {
        if (err) {
            throw err;
        }
        if (!doc) {
            response.render('404', {
                error: "Cannot connect to database"
            })
        } else {
            db.collection(`Cart_${userID}`).insertOne({
                user_id: userID,
                item_id: doc._id,
                name: doc.name,
                path: doc.path,
                price: doc.price
            }, (err, result) => {
                if (err) {
                    response.send('Unable to create account');
                }
                file = JSON.parse(fs.readFileSync('user_info.json'));
                file.cart.push({
                    user_id: userID,
                    item_id: doc._id,
                    name: doc.name,
                    path: doc.path,
                    price: doc.price
                });
                fs.writeFileSync('user_info.json', JSON.stringify(file,
                    undefined, 2));
                response.redirect('/shop')
            })
        }
    });
});

app.post('/delete-item', (request, response) => {
    app.locals.user = false;
    if (fs.existsSync("./user_info.json")) {
        var user_info = JSON.parse(fs.readFileSync('user_info.json'));
        app.locals.user = true;
        var id = user_info.id;
        var username = user_info.username;
    }
    var cart_item_id = request.body.cart_id;
    var db = utils.getDb();
    db.collection(`Cart_${id}`).remove({ _id: ObjectId(cart_item_id) }, (err, response) => {
        if (err) {
            response.render('404.hbs', {
                error: "Database error"
            })
        }
    });
    response.redirect('/my_cart')
});

app.listen(port, () => {
    console.log(`Server is up on port ${port}`);
    utils.init();
});
