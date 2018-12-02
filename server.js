var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();

app = express();
app.set('view engine', 'ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Hit me if you can';


// mongodb
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://user:pass1234@ds119164.mlab.com:19164/s381f-proj';

var fs = require('fs');
var formidable = require('formidable');

app.set('view engine', 'ejs');

app.use(session({
	name: 'session',
	keys: [SECRETKEY1, SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', function(req, res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	else {
		var criteria = {};
		var projection = { "_id": 1, "name": 1 };
		var result_arr = [];



		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			console.log('Connected to MongoDB\n');
			readRestaurant(db, criteria, projection, function(result) {
				db.close();
				console.log('JSON : ' + JSON.stringify(result));

				for (let i in result) {
					result_arr[i] = result[i];
				}
				res.status(200);
				res.render('index', { name: req.session.userid, result_arr });
			});
		});

	}
});

app.get('/register', function(req, res) {


	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/register.html');
	}
	else {
		res.redirect('/');
	}

});

app.post('/register', function(req, res) {
	var userid = req.body.userid;
	var password = req.body.password;
	var criteria = { "userid": userid };

	console.log(req.body)
	//console.log('About to insert: ' + JSON.stringify(new_r));
	function checkUser(db, criteria, callback) {
		var cursor = db.collection("user").find(criteria);
		var user = [];
		cursor.each(function(err, doc) {
			assert.equal(err, null);
			if (doc != null) {
				user.push(doc);
			}
			else {
				callback(user);
			}
		});
	}

	var createUser = function(db, callback) {
		db.collection('user').insertOne({
			"userid": userid,
			"password": password
		}, function(err, result) {
			//console.log(userid,password,err);
			assert.equal(err, null);
			console.log("User " + userid + " Created");
			callback(result);
		});
	};

	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err, null);
		console.log('Connected to MongoDB\n');
		checkUser(db, criteria, function(checked) {

			console.log("Checked : " + JSON.stringify(checked));
			if (checked.length == 0) {

				createUser(db, function(result) {
					db.close();
					console.log('JSON : ' + JSON.stringify(result));
					//res.redirect('/login');
					res.writeHead(200, { "Content-Type": "text/html" });
					res.write("<h1>Account is created successfully</h1><br />");
					res.write("<a href=\"/login\">Back to Login</a>");
					res.end();

				});
			}
			else {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.write("<h1>Account is existed</h1><br />");
				res.write("<a href=\"/register\">Back to Create User</a>");
				res.end();
			}
			db.close();

		});

	});

});

app.get('/login', function(req, res) {

	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		res.redirect('/');
	}

});



app.post('/login', function(req, res) {

	var userid = req.body.userid;
	var password = req.body.password;
	var criteria = { "userid": userid, "password": password };

	function loginUser(db, criteria, callback) {
		var cursor = db.collection("user").find(criteria);
		var user = [];
		cursor.each(function(err, doc) {
			assert.equal(err, null);
			if (doc != null) {
				user.push(doc);
			}
			else {
				callback(user);
			}
		});
	}


	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err, null);
		console.log('Connected to MongoDB\n');
		loginUser(db, criteria, function(result) {
			db.close();
			console.log('JSON : ' + JSON.stringify(result));
			if (result.length != 0) {
				console.log("Login " + result.length);
				req.session.authenticated = true;
				req.session.userid = result[0].userid;
				res.redirect('/');
			}
			else {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.write("<h1>Wrong Username / Password</h1><br />");
				res.write("<a href=\"/login\">Back to Login</a>");
				res.end();
				//res.redirect('/');
			}



			//res.writeHead(200, {"Content-Type": "text/plain"});
			//res.write(JSON.stringify(new_r));
			//res.end("\ninsert was successful!");			
		});
	});



});

app.get('/logout', function(req, res) {
	req.session = null;
	res.redirect('/');
});

app.get('/create', function(req, res) {
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	else {
		res.render('create', { name: req.session.userid });
	}
});

app.post('/create', function(req, res) {


	var new_r = {}; // document to be inserted
	//
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		console.log(JSON.stringify(files));
		var filename = files.filetoupload.path;

		if (files.filetoupload.type) {
			var mimetype = files.filetoupload.type;
		}
		if (files.filetoupload.size) {
			var size = files.filetoupload.size;
		}
		console.log("filename = " + filename);

		//console.log("name: "+fields["name"],fields.name);
		if (fields.restaurantid) new_r['restaurantid'] = fields.restaurantid;
		if (fields.name) new_r['name'] = fields.name;
		if (fields.borough) new_r['borough'] = fields.borough;
		if (fields.cuisine) new_r['cuisine'] = fields.cuisine;

		if (fields.building || fields.street || fields.zipcode || fields.lat || fields.lng) {
			var address = {};
			if (fields.building) address['building'] = fields.building;
			if (fields.street) address['street'] = fields.street;
			if (fields.zipcode) address['zipcode'] = fields.zipcode;
			if (fields.lat || fields.lng) address['coord'] = [fields.lat, fields.lng];
			new_r['address'] = address;
		}
		if (fields.owner) new_r['owner'] = fields.owner;

		fs.readFile(filename, function(err, data) {
			if (size > 0) {
			new_r['photo_mimetype'] = mimetype;
			new_r['photo'] = new Buffer(data).toString('base64');
			}
			console.log(data.length);
			console.log('About to insert: ' + JSON.stringify(new_r));

			if (new_r["name"] != null) {
				MongoClient.connect(mongourl, function(err, db) {
					assert.equal(err, null);
					console.log('Connected to MongoDB\n');
					insertRestaurant(db, new_r, function(result) {
						db.close();
						console.log(JSON.stringify(result));
						res.writeHead(200, { "Content-Type": "text/html" });
						console.log(JSON.stringify(new_r));
						res.write("<h1>Insert was successful!</h1><br />");
						res.end("<a href=\"/\">Back to Home Page</a>");

					});
				});

			}
			else {
				res.writeHead(200, { "Content-Type": "text/html" });

				res.write("<h1>Name can not be empty<h1><br/>");
				res.end("<a href=\"/create\">Go Back</a>");
			}
		});
	})

});


app.get('/view', function(req, res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	else {

		var id = req.query.id;
		var _id = (ObjectId.isValid(id)) ? ObjectId(id) : '';
		var criteria = { "_id": _id };


		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			console.log('Connected to MongoDB\n');
			readRestaurant(db, criteria, {}, function(result) {
				db.close();
				console.log('JSON : ' + JSON.stringify(result));
				if (result[0].restaurantid === undefined) result[0].restaurantid = '';
				if (result[0].borough === undefined) result[0].borough = '';
				if (result[0].cuisine === undefined) result[0].cuisine = '';
				if (result[0].photo === undefined) result[0].photo = '';
				if (result[0].photo_mimetype === undefined) result[0].photo_mimetype = '';
				if (result[0].address === undefined) result[0].address = '';
				if (result[0].address.building === undefined) result[0].address.building = '';
				if (result[0].address.street === undefined) result[0].address.street = '';
				if (result[0].address.zipcode === undefined) result[0].address.zipcode = '';
				if (result[0].address.coord === undefined) result[0].address.coord = '';
				var lat = (result[0].address.coord === undefined) ? '' : result[0].address.coord[0];
				var lng = (result[0].address.coord === undefined) ? '' : result[0].address.coord[1];
				if (result[0].grades === undefined) result[0].grades = '';
				if (result[0].grades.user === undefined) result[0].grades.user = '';
				if (result[0].grades.score === undefined) result[0].grades.score = '';

				

				res.render('view', { name: req.session.userid, result, lat, lng});
			});
		});

	}
});


app.get('/update', function(req, res) {
	var id = req.query.id;
	var _id = (ObjectId.isValid(id)) ? ObjectId(id) : '';
	var criteria = { "_id": _id };



	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	else {
		if (id != null && id != undefined && ObjectId.isValid(_id)) {
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(err, null);
				console.log('Connected to MongoDB\n');
				readRestaurant(db, criteria, {}, function(result) {
					db.close();
					console.log('JSON : ' + JSON.stringify(result));
					console.log("owner: " + result[0].owner);
					if (req.session.userid != result[0].owner) {
						res.writeHead(200, { "Content-Type": "text/html" });
						res.write("<h1>You are not the owner!</h1><br />");
						res.end("<a href=\"/\">Back to Home Page</a>");
					}
					else {
						if (result[0].restaurantid === undefined) result[0].restaurantid = '';
						if (result[0].borough === undefined) result[0].borough = '';
						if (result[0].cuisine === undefined) result[0].cuisine = '';
						if (result[0].photo === undefined) result[0].photo = '';
						if (result[0].photo_mimetype === undefined) result[0].photo_mimetype = '';
						if (result[0].address === undefined) result[0].address = '';
						if (result[0].address.building === undefined) result[0].address.building = '';
						if (result[0].address.street === undefined) result[0].address.street = '';
						if (result[0].address.zipcode === undefined) result[0].address.zipcode = '';
						if (result[0].address.coord === undefined) result[0].address.coord = '';
						var lat = (result[0].address.coord === undefined) ? '' : result[0].address.coord[0];
						var lng = (result[0].address.coord === undefined) ? '' : result[0].address.coord[1];
						if (result[0].grades === undefined) result[0].grades = '';
						if (result[0].grades.user === undefined) result[0].grades.user = '';
						if (result[0].grades.score === undefined) result[0].grades.score = '';
						res.render('update', { name: req.session.userid, result, id, lat, lng });
					}
				});
			});

		}
		else {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.write("<h1>Invalid query</h1><br />");
			res.end("<a href=\"/\">Back to Home Page</a>");
		}

	}
});

app.post('/update', function(req, res) {

	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		console.log(JSON.stringify(files));
		var filename = files.filetoupload.path;

		if (files.filetoupload.type) {
			var mimetype = files.filetoupload.type;
		}
		if (files.filetoupload.size) {
			var size = files.filetoupload.size;
		}
		console.log("filename = " + filename);
		var result_arr = [];
		var id = ObjectId(fields.id);
		var criteria = { _id: id };

		fs.readFile(filename, function(err, data) {




			var set = {
				'restaurantid': fields.restaurantid,
				'name': fields.name,
				'borough': fields.borough,
				'cuisine': fields.cuisine,
				'photo': (size > 0)? new Buffer(data).toString('base64'):fields.photo,
				'photo_mimetype': (size > 0)? mimetype:fields.photo_mimetype,
				'address.building': fields.building,
				'address.street': fields.street,
				'address.zipcode': fields.zipcode,
				'address.coord': [fields.lat, fields.lng],
				//'grades.user': req.body.user,
				//'grades.score': req.body.score,
				//"owner" : req.body.owner
			};
			console.log(req.body.id, fields.id, set);

			var updateRestaurants = function(db, callback) {
				db.collection('restaurant').updateOne(criteria, { $set: set }, function(err, results) {
					console.log(results);
					callback();

				});
			};
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(null, err);
				updateRestaurants(db, function() {
					db.close();
					console.log('update completed!');
					res.writeHead(200, { "Content-Type": "text/html" });
					res.write("<h1>Update completed!</h1><br />");
					res.write("<a href=\"/\">Back to Home Page</a>");
					res.end();
				});
			});
		});
	})


});



app.post('/delete', function(req, res) {


	var id = ObjectId(req.body.id);


	var removeRestaurants = function(db, callback) {
		db.collection('restaurant').deleteOne({ "_id": id },
			function(err, results) {
				console.log(results);
				callback();
			}
		);
	};

	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(null, err);
		removeRestaurants(db, function() {
			db.close();
			console.log('delete completed!');
			res.writeHead(200, { "Content-Type": "text/html" });
			res.write("<h1>Delete completed!</h1><br />");
			res.write("<a href=\"/\">Back to Home Page</a>");
			res.end();
		});
	});

});



app.get('/search', function(req, res) {
	var type = req.query.type;
	var id = req.query.id;
	var criteria;
	console.log(type, id);
	switch (type) {
		case 'name':
			// code
			criteria = { name: new RegExp(id, 'i') };
			break;
		case 'borough':
			// code
			criteria = { borough: new RegExp(id, 'i')};
			break;
		case 'cuisine':
			// code
			criteria = { cuisine: new RegExp(id, 'i') };
			break;
		default:
			// code
			break;
	}

	var projection = { "_id": 1, "name": 1 };
	console.log(criteria);

	if (!req.session.authenticated) {
		res.redirect('/login');
	}
	else {
		if (id != null || id != undefined) {
			MongoClient.connect(mongourl, function(err, db) {
				assert.equal(err, null);
				console.log('Connected to MongoDB\n');
				readRestaurant(db, criteria, projection, function(result) {
					db.close();
					console.log('JSON : ' + JSON.stringify(result));
					res.render('search', { name: req.session.userid, result });
				});
			});

		}
		else {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.write("<h1>Invalid search</h1><br />");
			res.end("<a href=\"/\">Back to Home Page</a>");
		}

	}
});


app.post('/rate', function(req, res) {


	var user = req.body.user;
	var score = req.body.score;
	var id = ObjectId(req.body.id);
	var view_id = req.body.id;
	var criteria = { _id: id };
	var read_criteria = { '_id': id, 'grades.user': user };
	var set = { 'grades': { 'user': user, 'score': score } };

	console.log(user, score, id, criteria, set);


	var rateRestaurants = function(db, callback) {
		db.collection('restaurant').updateOne(criteria, { $push: set },
			function(err, results) {
				console.log(results);
				callback();
			}
		);
	};

	if (score > 0 && score <= 10) {

		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(null, err);

			readRestaurant(db, read_criteria, { 'grades.user': 1 }, function(result) {

				console.log('JSON : ' + JSON.stringify(result)+ result.length);
				if (result.length > 0) {
					console.log('You have rated already!');
					res.writeHead(200, { "Content-Type": "text/html" });
					res.write("<h1>You have rated already!</h1><br />");
					res.write("<a href=\"/view?id=" + view_id + "\">Back to View Page</a>");
					res.end();
				}
				else {
					rateRestaurants(db, function() {
						db.close();
						console.log('rate completed!');
						res.writeHead(200, { "Content-Type": "text/html" });
						res.write("<h1>Rate completed!</h1><br />");
						res.write("<a href=\"/\">Back to Home Page</a>");
						res.end();
					});
				}
				db.close();
			});



		});

	}
	else {
		res.writeHead(200, { "Content-Type": "text/html" });
		res.write("<h1>Invalid Score</h1><br />");
		res.write("<a href=\"/view?id=" + view_id + "\">Back to View Page</a>");
		res.end();
	}

});


app.get('/api/restaurant/:type/:id', function(req, res) {
	var type = req.params.type;
	var id = req.params.id;
	var criteria;
	console.log(type, id);
	switch (type) {
		case 'name':
			// code
			criteria = { name: id };
			break;
		case 'borough':
			// code
			criteria = { borough: id };
			break;
		case 'cuisine':
			// code
			criteria = { cuisine: id };
			break;
		default:
			// code
			criteria = {};
			break;
	}


	//var projection = { "_id": 1, "name": 1 };
	var projection = {};
	console.log(criteria);

	if (id != null || id != undefined) {
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			console.log('Connected to MongoDB\n');
			readRestaurant(db, criteria, projection, function(result) {
				db.close();
				console.log('JSON : ' + JSON.stringify(result));
				res.status(200).json(result).end();
			});
		});

	}
	else {
		res.status(200).json({}).end();
	}

});

app.post('/api/restaurant', function(req, res) {
	var new_r = {}; // document to be inserted
	if (req.body.restaurantid) new_r['restaurantid'] = req.body.restaurantid;
	if (req.body.name) new_r['name'] = req.body.name;
	if (req.body.borough) new_r['borough'] = req.body.borough;
	if (req.body.cuisine) new_r['cuisine'] = req.body.cuisine;
	if (req.body.photo) new_r['photo'] = req.body.photo;
	if (req.body.photo_mimetype) new_r['photo_mimetype'] = req.body.photo_mimetype;

	if (req.body.building || req.body.street || req.body.zipcode || req.body.lat || req.body.lng) {
		var address = {};
		if (req.body.building) address['building'] = req.body.building;
		if (req.body.street) address['street'] = req.body.street;
		if (req.body.zipcode) address['zipcode'] = req.body.zipcode;
		if (req.body.lat || req.body.lng) address['coord'] = [req.body.lat, req.body.lng];
		new_r['address'] = address;
	}
	if (req.body.owner) new_r['owner'] = req.body.owner;

	console.log('About to insert: ' + JSON.stringify(new_r));

	if (new_r["name"] != null && new_r["owner"] != null) {
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			console.log('Connected to MongoDB\n');
			insertRestaurant(db, new_r, function(result) {
				db.close();
				console.log(JSON.stringify(result));
				res.json({ status: "ok", _id: new_r._id });

			});
		});

	}
	else {
		res.json({ status: "failed" });
	}


});

function readRestaurant(db, criteria, projection, callback) {
	var cursor = db.collection("restaurant").find(criteria, projection);
	var restaurant = [];
	cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurant.push(doc);
		}
		else {
			callback(restaurant);
		}
	});
}

function insertRestaurant(db, r, callback) {
	db.collection('restaurant').insertOne(r, function(err, result) {
		assert.equal(err, null);
		console.log("Insert was successful!");
		callback(result);
	});
}
app.listen(process.env.PORT || 8099);
