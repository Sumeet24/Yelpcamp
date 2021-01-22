const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const methodOverride = require("method-override");
mongoose.connect('mongodb+srv://sd:iamsd_24@cluster0-dcszp.mongodb.net/test?retryWrites=true&w=majority',{
	useNewUrlParser : true,
	useCreateIndex : true
}).then(()=>{
	console.log('connected to DB');
}).catch(err=>{
	console.log('Error : ' + err.message);
});
const Campground = require('./models/campground');
const Comment = require('./models/comment');
const User = require('./models/user');


app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine","ejs");
app.use(methodOverride("_method"));
app.use(flash());

// Passport Config
app.use(require("express-session")({
	secret : "Once again Rusty wins cutest dog!",
	resave : false,
	saveUninitialized : false
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req,res,next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next(); 
});

app.get("/",function(req,res){
	res.render("landing");
});

//INDEX - show all campgrounds
app.get("/campgrounds",function(req,res){	
	//res.render("campgrounds",{campgrounds:campgrounds});
	Campground.find({},function(err,allCampgrounds){
		if(err){
			console.log(err);
		}
		else{
			res.render("campgrounds",{campgrounds:allCampgrounds});
			//console.log(allCampgrounds);
		}
	})
});

//CREATE - add new campground to database
app.post("/campgrounds",isLoggedIn,function(req,res){
	// get data from form and add to campgrounds array
	var name = req.body.name;
	var image = req.body.image;
	var des = req.body.description;
	var author = {
		id: req.user._id,
		username: req.user.username
	};
	var obj = {name : name , image : image , description : des,author : author};
	//campgrounds.push(obj);
	// Create a new campground and save to DB 
	Campground.create(obj , function(err,newlyCreated){
		if(err){
			console.log(err);
		}else{
			// redirect to campgrounds page
			res.redirect("/campgrounds");		
		}
	});
	
});

//NEW - show form to create new campground
app.get("/campgrounds/new",isLoggedIn,function(req,res){
	res.render("new");
});

// Show more info about one campground
app.get("/campgrounds/:id",isLoggedIn,function(req,res){
	// find campground with provided ID
	Campground.findById(req.params.id).populate("comments").exec(function(err,foundCampground){
		if(err){
			console.log(err);
		}
		else{
			// render show template with that campground
			res.render("show",{campground : foundCampground});
		}
	});
	
});



// Edit Campground
app.get("/campgrounds/:id/edit",isLoggedIn,checkCampgroundOwnership,function(req,res){
		Campground.findById(req.params.id,function(err,foundCampground){
			res.render("edit",{campground : foundCampground});	
		});
});

// UPDATE CAMPGROUND 
app.put("/campgrounds/:id/edit",isLoggedIn,checkCampgroundOwnership,function(req,res){
	// find and update correct campground
	Campground.findByIdAndUpdate(req.params.id , req.body.obj , function(err,updatedCampground){
		if(err){
			console.log(err);
			res.redirect("/campgrounds");
		}else{
			// redirect to show page
			res.redirect("/campgrounds/" + req.params.id);
		}
	});
});

// DESTROY Campground 
app.delete("/campgrounds/:id",isLoggedIn,checkCampgroundOwnership,function(req,res){
	Campground.findByIdAndRemove(req.params.id,function(err){
		if(err){
			res.redirect("/campgrounds");
		}
		else{
			 res.redirect("/campgrounds");
		}
	});
});


//===============
// Comment routes
//===============

app.get("/campgrounds/:id/comments/new", isLoggedIn ,function(req,res){
	// find campground by id
	Campground.findById(req.params.id , function(err,campground){
		if(err){
			console.log(err);
		}
		else{
			res.render("newc",{campground:campground});	
		}
	});
	
});

app.post("/campgrounds/:id/comments",isLoggedIn,function(req,res){
	// lookup campground using ID
	Campground.findById(req.params.id,function(err,campground){
		if(err){
			//console.log(err);
			req.flash("error","Something went wrong");
			res.redirect("/campgrounds");
		}else{
			
			Comment.create(req.body.comment,function(err,comment){
				if(err){
					console.log(err);
				}else{
					// connect new comment to campground
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.save();
					campground.comments.push(comment);
					campground.save();
					// redirect to campground show page
					req.flash("success","Successfully added comment");			
					res.redirect('/campgrounds/' + campground._id );
				}
			});
		}
	});
	
});

// /campgrounds/:id/comments/:comment_id/edit
// comments edit
app.get("/campgrounds/:id/comments/:comment_id/edit",isLoggedIn,checkCommentOwnership,function(req,res){
	// campground id : req.params.id
	Comment.findById(req.params.comment_id,function(err,foundComment){
		if(err){
			res.redirect("back");
		}else{
			res.render("editc",{campground_id:req.params.id,Comment: foundComment});
		}
	});
});

// campgrounds/:id/comments/:comment_id
// Comment UPDATE
app.put("/campgrounds/:id/comments/:comment_id",isLoggedIn,checkCommentOwnership,function(req,res){
	Comment.findByIdAndUpdate(req.params.comment_id,req.body.comment,function(err,updatedComment){
		if(err){
			res.redirect("back");
		}
		else{
			res.redirect("/campgrounds/"+req.params.id);
		}
	});
});

// campgrounds/:id/comments/:comment_id
// Comment DELETE
app.delete("/campgrounds/:id/comments/:comment_id",isLoggedIn,checkCommentOwnership,function(req,res){
	// find by id and delete
	Comment.findByIdAndRemove(req.params.comment_id,function(err){
		if(err){
			res.redirect("back");
		}
		else{
			req.flash("success","Comment deleted");
			res.redirect("/campgrounds/" + req.params.id);
		}
	});
});

// ==========
// AUTH ROUTES
// ===========

// show register form
app.get("/register",function(req,res){
	res.render("register");	
});
// handel sign up logic 
app.post("/register",function(req,res){
	var newUser = new User({username : req.body.username});  
	User.register(newUser , req.body.password, function(err,user){
		if(err){
			//console.log(err);
			req.flash("error",err.message);
			return res.render("register");
		}else{
			passport.authenticate("local")(req,res,function(){
				req.flash("success","Welcome to YelpCamp " + user.username );
				res.redirect("/campgrounds");	   
			});
		}
	});
	
});

// show login form
app.get("/login",function(req,res){
	res.render("login");
});

// handeling loging logic
// app.post("/login" , middleware , callback);
app.post("/login", passport.authenticate("local",
		{
			successRedirect : "/campgrounds",
			failureRedirect : "/login"
		}) ,function(req,res){
	
});

// log out 
app.get("/logout",function(req,res){
	req.logout();
	req.flash("success","Logged you out!");
	res.redirect("/login");
})



// middleware

function isLoggedIn(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error","Please login First!");
	res.redirect("/login");
}

function checkCommentOwnership(req,res,next){
	Comment.findById(req.params.comment_id,function(err,foundComment){
		if(err){
			req.flash("error","Campground not found");
			res.redirect("back");
		}
		else{
			if(foundComment.author.id.equals(req.user._id)){
			 	next();  
			}
			else{
				req.flash("error","You don't have permission to do that");
				res.redirect("back");
			}
		}
	});
}

function checkCampgroundOwnership(req,res,next){
	Campground.findById(req.params.id,function(err,foundCampground){
		if(err){
			console.log(err);
			res.redirect("back");
		}else{
			// does user own the campground?
			if(foundCampground.author.id.equals(req.user._id)){
				next();
			}else{
				res.redirect("back"); 
			}
		}
	});
}

// app.listen(3000,function(){
// 	console.log("Server started");
// });

// app.listen(port,function(){
// 	console.log("Server started");
// });

app.listen(process.env.PORT,process.env.IP,function(){
	console.log("Server started");
});