var AWS = require('aws-sdk')
// Set region for AWS SDKs
AWS.config.region = process.env.REGION

var express = require('express');
var session = require('express-session');
var app = express();
var port = process.env.PORT || 3000;
var path = require('path');
var db = require('./server/db.js');
var bodyParser = require('body-parser');
var upload = require("express-fileupload");

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

// ----------------------------- MIDDLEWARE -------------------------------- //

//used to get the correct directory which is the root directory 
app.use(express.static(path.join(__dirname, './')));

//allows us to use data send from html forms using req.body.name
app.use(express.urlencoded({ extended: false }));

//each user has a different session so we can keep track of them no matter where they are on the site
app.use(session({secret: "SecretKey"}));

//use the ejs files in the views folder however 
app.set('view engine', 'ejs');

//redefine views folder to the right path
app.set('views', path.join(__dirname, './views'));

app.use(upload());

// ------------------------------------------------------------------------- //


//for creating a express session for each user 
function user(username, role, dept=-1, isManager=false, isCareTaker=false, isMember=false) {
   this.username = username;
   this.role = role;  //is the user an employee or customer
   this.dept = dept;
   this.isManager = isManager;
   this.isCareTaker = isCareTaker;
   this.isMember = isMember;
 }


function assignEmployeeInfo(emp, dept, isM, isC, isMem, cb)
{
    if(emp!=false)
    {
        emp.dept = dept;
        if(isM > 0)
            emp.isManager = true;
        if(isC > 0)
            emp.isCareTaker = true;
        emp.isMember = isMem;
        cb(true);
    }
    else
        cb(false);
}


// ----------------------------- ROUTES -------------------------------- //
//default route will point to index.html which is the homepage

app.get('/', function(req, res){
    
    if(!req.session.user)
    {
        res.sendFile(path.join(__dirname,'/main.html'));
    }
    else if(req.session.user.role == "Customer")
        res.redirect('/customerFrontPage');
    else if(req.session.user.role == "Employee"){
        if(req.session.user.isManager)
        {
            if(req.session.user.dept==9) 
                res.redirect('/vetManager');
            else if(req.session.user.isCareTaker) 
                res.redirect('/caretakerManager');
            else 
                res.redirect('/managerFrontPage',);
        }
        else if(req.session.user.isCareTaker)
        {
                res.redirect('/caretaker');
        }
        else if(req.session.user.dept === 9){
            res.redirect('/vet');
        }
        else
            res.redirect('/shop'); // for shop employees
    }
});


app.post('/signup', function(req, res){
   //if one of the sign up fields is blank it wont work
   if(!req.body.firstName, !req.body.lastName, !req.body.email, !req.body.password){
      res.render('errorPage', {message: "Error one of the fields are missing."});   
   }
   db.signUpCustomer([req.body.firstName, req.body.lastName, req.body.email, req.body.password], function(err, data){
      if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
      else{
        
          if(data === true){
              res.redirect("/customerLogin");
              
          }else{
              res.render('errorPage', {message: "Error user with that email already exists."});  //user already exists with this email
          } 
      }
  }); 
});

app.get('/employeeLogin', function(req, res){
    res.render('employeeLogin');
 });

//on submit of the employee login form
app.post('/employeeLogin', function(req, res){
    var username = req.body.username;
    var password = req.body.password;
    //either username or password is blank
    if(!username || !password){
        res.render('errorPage', {message: "Missing required fields"});
    } else {
        db.authenticateEmployee([username, password], function(err, data){
            if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
            else{
              
                if(data === true){
                    req.session.user = new user(username, "Employee");
                    db.getEmployeeInfo(req.session.user, assignEmployeeInfo, function(val)
                    {
                        if(val!=false)
                            res.redirect('/');    
                        else
                            res.render('errorPage', {message:"Something went wrong"});
                    });
                }else{
                  res.render('errorPage', {message: "Wrong username or password"});
                    
                } 
            }
        });
    }
 });



app.get('/employeeLogout', function(req, res){
    req.session.destroy(function(){
        console.log("employee Logged Out");
    });
    res.redirect('/employeeLogin');
 });

/* pretty much copy paste of the employee login above but for customers instead of employees*/
app.get('/customerLogin', function(req, res){
    res.render('customerLogin');
});

//on submit of the login form this will be run to authenticate customer
app.post('/customerLogin', function(req, res){
    var username = req.body.username;
    var password = req.body.password;

    //either username or password is blank
    if(!username || !password){
        res.render('errorPage', {message: "Missing required fields"});
    } else {
        db.authenticateCustomer([username, password], function(err, data){
            if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
            else{

                if(data === true){
                    req.session.user = new user(username, "Customer");
                    res.redirect("/customerFrontPage");
                    
                }else{
                  res.render('errorPage', {message: "Wrong username or password"});
                    
                } 
            }
        });     
        
    }
 });

app.get('/customerLogout', function(req, res){
    req.session.destroy(function(){
       console.log("user logged out.")
    });
    res.redirect('/customerLogin');
 });



// ------------------------------------------------------------------------- //


/* can be used in each route to see if the user is logged in */
function checkCustomerSignIn(req, res, next){
   if(!req.session.user){
      var err = new Error("Not logged in!");
      next(err);
   }
   else if(req.session.user.role === "Customer"){
      
      next();   //If session exists, proceed to page
   }else {
      var err = new Error("Not logged in!");
      next(err);
   }
}


/* can be used in each route  to see if the user is logged in and if it is an employee*/
function checkEmployeeSignIn(req, res, next){
   if(!req.session.user){
      var err = "You are not logged in!";
      res.render('errorPage', {message: err});
   }
   else if(req.session.user.role === "Employee"){
      
       next();   //If session exists, proceed to page
   }else {
      var err = "You are not logged in!";
      res.render('errorPage', {message: err});
   }
}
/*---------------------------------------- Regular Employee Page Routes ----------------------------------*/
/*app.get('/regularEmployee', checkEmployeeSignIn, function(req, res)
{
        res.render("regEmployee_page");
})
*/




/*---------------------------------------- Caretaker and Vet Page Routes ----------------------------------*/

app.get('/caretaker',checkEmployeeSignIn, function(req,res)
{
    var data = [];
    var username = req.session.user;

    db.getEmployeeName(username, function(employee){
        if(employee!=false)
        {
            data.employee = employee;  
            db.getEmployeesAnimals(username, function(animals){
                data.animals = animals;
                if(animals!=false)
                res.render("caretaker.ejs", { data: data });
                else
                res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
    });  
});

app.get('/caretakerManager',checkEmployeeSignIn, function(req,res)
{
    var data = [];
    var username = req.session.user;

    db.getEmployeeName(username,function(employee){
        if(employee!=false)
        {
            data.employee = employee;
            db.getCareTakersInfo(function(caretakers){
                data.caretakers = caretakers;
                if(caretakers!=false)
                res.render("caretakerManager.ejs", { data: data });
                else
                res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
   }); 
});

app.get('/vet',checkEmployeeSignIn, function(req,res)
{
    var data = [];
    var username = req.session.user;

    db.getEmployeeName(username,function(employee){
        if(employee!=false)
        {
            data.employee = employee;
            db.getAllAnimals(function(animals){
                data.animals = animals;
                if(animals!=false)
                res.render("vet.ejs", { data: data });
                else
                    res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
    });   
});

app.get('/vetManager', function(req,res)
{
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.isManager && req.session.user.dept==9)
    {
        var data = [];
        var username = req.session.user;
        //if you nest the functions then they will always run in order
        // otherwise you may get unexpected behavior like some data not loading
        db.getEmployeeName(username,function(employee){
            if(employee!=false)
            {
                data.employee = employee;
                    db.getAllAnimals(function(animals){
                    data.animals = animals;
                    if(animals!=false)
                    {
                    db.getAllVets(function(employees)  //get employees from db.js file and then call the function 
                    {
                        data.employeeList = employees;
                        if(employees!=false)
                            res.render("vetManager.ejs", { data:data });
                            else
                            res.render('errorPage', {message:"Something went wrong"});
                    });
                    }
                    else
                        res.render('errorPage', {message:"Something went wrong"});
                });
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});



app.get('/vetTables',checkEmployeeSignIn, function(req,res){
    var data = [];
    db.getEmployeeName(req.session.user,function(employee){
        if(employee!=false)
        {
            data.employee = employee;
            db.getAllAnimals(function(animalList){
            data.animalList = animalList;
            if(animalList!=false){
                db.getFoodStock(function(foodStock){
                data.foodStock = foodStock;
                if(foodStock!=false){
                    db.getMedicineStock(function(medicineStock){
                        data.medicineStock = medicineStock;
                        if(medicineStock!=false)
                            res.render("vet_tables.ejs", {data :data});
                        else
                            res.render('errorPage',{message:"Something went wrong"});
                    });
                }
                else
                    res.render('errorPage',{message:"Something went wrong"});
                });
                }
                else
                    res.render('errorPage',{message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
   }); 
});



app.get('/insertNewAnimal', function(req, res)
{
    data = [];
    db.getEmployeeName(req.session.user,function(employee){
        if(employee!=false)
        {
            data.employee = employee;
            db.getAnimalList(function(animals){
                data.animalList = animals;
                if(animals!=false)
                res.render("insertAnimal.ejs",{data:data});
                else
                res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
    });
});


//conenct html form to this route and send all the data like animalname, species etc...
app.post('/insertNewAnimal', function(req, res)
{
    var file = null;
    if(req.files)
        file = req.files.image_path;
    var filename=null;
    if(file) filename= file.name;
    var data = [req.body.animalname, req.body.species, req.body.dob, req.body.gender, req.body.enclosure, req.body.status, req.body.diet, req.body.feedings, filename];
    db.insertNewAnimal(data, function(err,response)
    {
        if(err === true){
            res.render("errorPage.ejs", {message: "Error animal not inserted"});
        }
        else{
          if(req.files){
      
          file.mv("./assets/img/"+filename, function(err){
            if(err){
              console.log(err)
              res.end("error occured")
            }
            else{
              res.redirect("/insertNewAnimal");
              }
            })
          }
          else if(!req.files)
          {
            res.redirect("/insertNewAnimal");
          }
        }
    })
});



/* --------------------------------------- Manager Page Routes  ----------------------------------------- */

app.get('/managerFrontPage',checkEmployeeSignIn, function(req,res)
 {   
     if(req.session.user.isManager)
     {
        var userid = req.session.user;
        const data = [];

        db.getEmployeeName(userid, function(employee){
            if(employee!=false)
            {
                data.employee = employee;
                res.render("manager_frontPage", {data: data});
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
    else
        res.render('errorPage', {message:"You're not a manager"});
    
 });

app.get('/managerTables',checkEmployeeSignIn, function(req,res)
{   
    var data = [];   //used to pass to the manager_table ejs file

    db.getAllEmployees(function(employees)  //get employees from db.js file and then call the function 
    {
       data.employeeList = employees;
       if(employees!=false){
          db.getFoodStock(function(foodStock)  
          {
           data.foodStock = foodStock;
           if(foodStock != false){
                db.getMedicineStock(function(medicineStock)  //after running the last query we render the page
                {
                    data.medicineStock = medicineStock;
                    if(medicineStock!=false){
                        db.getEmployeeName(req.session.user,function(employee){
                            data.employee = employee;
                            if(employee!=false)
                                res.render("manager_tables", { data: data });
                            else 
                                res.render('errorPage', {message:"Something went wrong"});
                        });
                    }
                    else
                        res.render('errorPage', {message:"Something went wrong"});
                });
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
       }
       else
            res.render('errorPage', {message:"Something went wrong"});
    });
});

//these 3 routes are if the user isnt logged in it redirects them to employeeLogin
app.use('/managerFrontPage', function(err, req, res, next){
    //User should be authenticated! Redirect him to log in.
    res.redirect('/employeeLogin');
});



//this route generates a report between a start date and end date which comes from an html form
 app.post('/generateReport', function(req, res){
    var startdate = req.body.startdate;
    var enddate = req.body.enddate;
 
    var data = [];    
    if(!startdate || !enddate){
        res.render('errorPage', {message: "Missing required fields"});
    } else {

        db.getRevenueTest([startdate, enddate], function(err,revenue){
            if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
            else{
                data.revenue = revenue;
                db.getOrdersTest([startdate, enddate], function(err,orders){
                    if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
                    else{
                        data.orderTable = orders;
                        db.getMostSoldProductsTest([startdate, enddate], function(err,products){
                            if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
                            else{
                                data.mostSoldProducts = products;
                                db.getTicketDistribution([startdate, enddate], function(err,tickets){
                                    if(err) {console.log("error"); res.render('errorPage', {message:"Could not connect to database. Check your connection and try again."});}
                                    else{
                                        data.ticketDistribution = tickets;
                                        db.getEmployeeName(req.session.user, function(employee){
                                          data.employee=employee;
                                          if(employee!=false)
                                            res.render("financialReport", {data: data});
                                          else
                                            res.render('errorPage', {message:"Something went wrong"});
                                        });
                                    }
                                });
                            }
                        });
                    }
                }); 
            }
        });     
    }
 });

/*------------------------------------------------------------ */





/* --------------------- Shop Routes  ------------------------- */
app.get('/shop', function(req,res)
{   
    var items = [];
    db.getProducts(function(items)
    {
        if(items!=false)
        {
            if(!req.session.user)
                res.render("shop.ejs", {items: [items, false, "none", -1]});
            else
                res.render("shop.ejs", {items: [items, req.session.user.isMember, req.session.user.role, req.session.user.dept]});
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
    });
});

app.post('/checkout/:id/:size/:price/:imagepath/', function(req,res)
{
    var cart = {id: req.params.id, size: req.params.size, price: req.params.price, quantity: req.body.quantity, image_path: req.params.imagepath};
    if(!req.session.user)
        res.render("checkout.ejs", {cart: cart});
    else if(req.session.user.role == "Employee")
        res.render("in_storeCheckout.ejs",{cart: cart});
    else
        res.render("checkout.ejs",{cart: cart});
});

app.post('/buy/:id/:size/:quantity/:total/:in_store', function(req,res)
{
    var newID;
    var order = {product_id: req.params.id, product_size: req.params.size, quantity: req.params.quantity, total: req.params.total, email: req.body.email, address: req.body.address, city: req.body.city, state: req.body.state, zipcode: req.body.zip, in_store : req.params.in_store};
    if(order.in_store == 0)
    {
        db.makeOnlinePurchase(order, function(response){
            if(response!=false)
            {
                newID = response;
                newID = newID.insertId;
                res.render("confirmation.ejs", {newID:newID});
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
    else
    {
        db.ringUpCustomer(order, function(response){
            if(response!=false)
            {
                newID = response;
                newID = newID.insertId;
                res.render("confirmation.ejs", {newID:newID});
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
});

// lets employees update stock 
app.get('/updateStock', function(req, res)
{
    if(!req.session.user)
        res.render('errorPage', {message: "You don't have access to this page"});
    else if(req.session.user.dept == 5 ||  req.session.user.dept== 6 || req.session.user.dept==7)
    {
        db.getProductsForUpdate(req.session.user.dept, function(data){
            if(data!=false)
                res.render('updateStock', {data:data});
            else
                res.render('errorPage', {message:"We had a problem"});
        });
    }
    else 
        res.render('errorPage', {message: "You don't have access to this page"});
});

app.post('/updateStock/:id/:size', function(req, res){
    db.updateStock(req.params.id, req.params.size, req.body.quantity, function(data)
    {
       if(data!=false)
         res.redirect('/updateStock');
       else
          res.render('errorPage', {message:"Something went wrong"});
    });
});


/* --------------------- Alert Routes  ----------------------- */
app.get('/alertOptions/', function(req, res)
{
    if(!req.session.user)
        res.render('errorPage', {message: "You don't have access to this page!"});
    else if(req.session.user.role == "Customer")
        res.render('errorPage', {message: "You don't have access to this page!"});
    else if(req.session.user.role == "Employee")
    {
        if(req.session.user.isManager || req.session.user.isCareTaker || req.session.user.dept==9)
            res.render('alertOptions.ejs');
        else
            res.render('errorPage', {message: "You don't have access to this page!"});
    }
});


app.post('/alert', function(req, res)
{
    if(req.session.user.dept == 9)
    {
        db.getVetAlerts(req.body.time, function(info)
        {
            if(info !== false)
                res.render('vet_alerts.ejs', {data:[info, req.body.time]});
            else 
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
    else if(req.session.user.isCareTaker)
    {
        // render caretaker report
        db.getCareTakerAlerts(req.session.user, req.body.time, function(alerts, numHealthy, numSick, numPregnant, numDeceased)
        {
           if(alerts===false)
              res.render('errorPage', {message:"Something went wrong"});
           else
               res.render('caretaker_alerts.ejs', {data:[alerts, req.body.time, numHealthy, numSick, numPregnant,numDeceased]});
        });
    }
    else if(req.session.user.isManager)
    {
        // render manager reports
        // may have to differentiate based on departments
        if(req.session.user.dept == 12)
        {
            db.getNutritionAlerts(req.body.time, function(info)
            {
                if(info!==false)
                    res.render('nutrition_alerts.ejs', {data:[info, req.body.time]});
                else
                    res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else if(req.session.user.dept >=5 && req.session.user.dept <=7)
        {
            db.getStoreManagersAlerts(req.session.user.username, req.body.time, function(info)
            {
                if(info !== false)
                    res.render('manager_alerts.ejs', {data:[info, req.body.time]});
                else
                    res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message: "You don't have access to this page!"}); // any other managers
    }
});

/* --------------------- Tracking Routes  ----------------------- */

// search 1 order
app.get('/searchOrderStatus', function(req, res)
{
    res.render('searchOrderStatus.ejs');
});

app.post('/searchOrder', function(req, res)
{
    db.searchOrder(req.body.number, req.body.zip, function(data)
    {
        if(data != false)
            res.render('order_status.ejs', {data:data});
        else
            res.render('errorPage', {message: "We couldn't find your order!"});
    })
});


app.get('/customerFrontPage', function(req, res)
{
    if(!req.session.user)
        res.render('errorPage', {message: "Please sign in or create an account"});
    else if(req.session.user.role == "Employee")
        res.render('errorPage', {message: "You're not a customer"});
    else if(req.session.user.role == "Customer")
    {
        db.getCustomerInfo(req.session.user.username, function(data)
        {
            if(data!=false)
            {
                req.session.user.isMember = data[0].isMember;
                res.render('customerFrontPage.ejs', {data:data});
            }
            else
                res.render('errorPage',{message:"Something went wrong"});
        });
    }
});


app.get('/orderHistory', function(req, res)
{
    if(!req.session.user)
        res.send("Please sign in or create an account");
    else if(req.session.user.role == "Employee")
        res.send("You're not a customer");
    else if(req.session.user.role == "Customer")
    {
        db.getOrderHistory(req.session.user.username, function(data)
        {
           if(data!=false)
               res.render('orderHistory.ejs', {data:data});
           else
              res.render('errorPage', {message:"Something went wrong"});
        });
    }
});


app.get('/getMembership', function(req,res)
{
    if(!req.session.user)
        res.render('errorPage', {message: "Please sign in or create an account"});
    else if(req.session.user.role == "Employee")
        res.render('errorPage', {message:"You're not a customer"});
    else if(req.session.user.role == "Customer")
    {
        db.getMembership(function(data)
        {
           if(data!=false)
               res.render('becomeMember.ejs', {data:data});
           else
              res.render('errorPage', {message:"Something went wrong"});
        });
    }
});

app.get('/getMedicine/:animalID', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message: "You don't have access to this page"});
    else if(req.session.user.dept == 9)
    {
      var data = [];
      db.getEmployeeName(req.session.user, function(employee){
        if(employee!=false)
        {
            data.employee = employee;
            db.getMedicine(req.params.animalID, function(med){
            data.med = med;
                if(med != false)
                    res.render('giveMed.ejs', {data:data});
                else
                    res.render('errorPage', {message: "This animal doesn't take any medicine"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
      })
        
    }
    else
        res.render('errorPage', {message: "You don't have access to this page"});
});

// routes for vets to see animal medicine info and update medicine stock
app.post('/giveMedicine/:id/:doseAmount/:animal', function(req,res){
    db.giveMedicine(req.params.id, req.body.doses, req.params.doseAmount, function(info){
        if(info != false)
            res.redirect('/getMedicine/' + req.params.animal);
        else
            res.render('errorPage', {message:"Something went wrong"});
    });
});

// routes for caretakers to feed animals
app.get('/getFood/:animalID', function(req, res)
{
    if(!req.session.user)
        res.render('errorPage', {message: "You don't have access to this page"});
    else if(req.session.user.dept == 15 || req.session.user.dept == 9)
    {
      var data = [];
        db.getEmployeeName(req.session.user,function(employee){
          data.employee = employee;
          if(employee!=false)
          {
            db.getFood(req.params.animalID, function(food){
                if(food != false){
                    data.food = food;
                    res.render('giveFood.ejs', {data:data});
                }
                else
                    res.render('errorPage', {message: "This animal doesn't have any food listed for them in the database"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
    });
    }
    else
        res.render('errorPage', {message: "You don't have access to this page"});
});

app.post('/giveFood/:id/:servingAmount/:animal', function(req, res){
    db.giveFood(req.params.id, req.body.servings, req.params.servingAmount, function(info){
        if(info != false)
            res.redirect('/getFood/' + req.params.animal);
        else
            res.render('errorPage', {message:"Something went wrong"});
    });
});

// routes to let caretaker manager assign animals to caretakers
app.get('/assignAnimal', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.isManager && req.session.user.dept==15)
    {
        data =[];
        db.getEmployeeName(req.session.user,function(employee){
            data.employee = employee;
            if(employee!=false)
            {
                db.getAllAnimals(function(animals){
                data.animals = animals;
                    if(animals != false)
                        res.render('viewAnimals', {data:data});
                    else
                        res.render('errorPage', {message: "Something went wrong"});
                });
            }
            else
                res.render('errorPage', {message:"Something went wrong"});
        });
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.get('/assignCaretaker/:animal', function(req,res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.isManager && req.session.user.dept==15)
    {
      var data = [];
      db.getEmployeeName(req.session.user,function(employee){
            data.employee = employee;
            if(employee!=false)
            {
                db.getAllCaretakers(function(caretakers){
                    data.caretakers = [caretakers, req.params.animal];
                    if(caretakers != false)
                        res.render('viewCaretakers', {data:data});
                    else
                        res.render('errorPage', {message: "Something went wrong"});
                });
            }   
            else
                res.render('errorPage', {message:"Something went wrong"});
      });
        
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.post('/assign/:animal/:caretaker', function(req, res){
    db.assignAnimalToCaretaker(req.params.animal, req.params.caretaker, function(result)
    {
        if(result != false)
            res.redirect('/');
        else
            res.render('errorPage', {message: 'That caretaker is already assigned to that animal'});
    });
});

// routes that allow vets to prescribe medicine
app.get('/prescribeMedicine/:animal', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.dept==9)
    {
      var data = [];
      db.getEmployeeName(req.session.user,function(employee){
        data.employee = employee;
        if(employee!=false)
        {
            db.getMedicineStock(function(medicines){
            data.medicines = [medicines, req.params.animal];
                if(medicines != false)
                    res.render('viewMedicine', {data: data});
                else
                    res.render('errorPage', {message:"Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
      });
        
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.post('/prescribeMedicine/:animal/:medicine', function(req, res){
    db.prescribeMedicine(req.params.animal, req.params.medicine, req.body.dose, req.body.frequency, req.body.duration, req.body.disease, function(result){
        if(result != false)
            res.redirect('/getMedicine/' + req.params.animal);
        else
            res.render('errorPage', {message:"This animal is already taking this medicine"});
    });
});

// allow vets to update medicine stock
app.get('/updateMedStock', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.dept==9)
    {
        db.getMedicineStock(function(medicine){
            if(medicine!=false)
                res.render('medStock', {data:medicine});
            else
                res.render('errorPage', {message: "Something went wrong"});
        });
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.post('/updateMedStock/:medicine', function(req, res){
    db.updateMedStock(req.params.medicine, req.body.quantity, function(result){
        if(result != false)
            res.redirect('/updateMedStock');
        else
            res.render('errorPage', {message: "We encountered an error"});
    })
});

// allow caretakers to update food stock
app.get('/updateFoodStock', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.dept==15 || req.session.user.dept==12)
    {
        db.getFoodStock(function(food){
            if(food != false)
                res.render('foodStock', {data:food});
            else
                res.render('errorPage', {message: "Something went wrong"});
        });
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});


app.post('/updateFoodStock/:food', function(req, res){
    db.updateFoodStock(req.params.food, req.body.quantity, function(result){
        if(result != false)
            res.redirect('/updateFoodStock');
        else
        res.render('errorPage', {message: "Something went wrong"});
    });
});

// routes to allow vets assign food to animals
app.get('/assignFood/:animal', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.dept == 9)
    {
      var data = [];
      db.getEmployeeName(req.session.user,function(employee){
        data.employee = employee;
        if(employee!=false)
        {
            db.getFoodStock(function(food){
                if(food != false){
                    data.foods = [food,req.params.animal];
                    res.render('viewFood', {data:data});
                }
                else
                    res.render('errorPage', {message: "Something went wrong"});
            });
        }
        else
            res.render('errorPage', {message:"Something went wrong"});
      });
        
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.post('/assignFood/:animal/:food', function(req, res){
    db.assignFood(req.params.animal, req.params.food, req.body.serving, req.body.frequency, function(result)
    {
        if(result != false)
            res.redirect('/getFood/' + req.params.animal);
        else
            res.render('errorPage', {message:"This animal is already eating this food"});
    });
});


app.get('/viewAnimal/:animal', function(req,res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.isManager && req.session.user.dept==9)
    {
        var data = [];
        db.getAnimalInfo(req.params.animal,function(animal){
            data.animal = animal;
           if(animal!=false){
               db.getEmployeeName(req.session.user,function(employee){
                 data.employee = employee;
                 if(employee!=false)
                    res.render('viewAnimalInfo', {data:data});
                 else
                    res.render('errorPage', {message:"Something went wrong"});
               });
           }
           else
              res.render('errorPage', {message:"Something went wrong"});
        });
        
    }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});


app.get('/updateAnimal/:animal', function(req, res){
  var data = [];
    db.getAnimalInfo(req.params.animal, function(animal){
        data.animal = animal;
       if(animal!=false){
           db.getEmployeeName(req.session.user,function(employee){
             data.employee = employee;
             if(employee!=false)
                res.render('updateAnimal', {data:data});
             else
                res.render('errorPage', {message:"Something went wrong"});
           });
       }
       else
          res.render('errorPage', {message:"Something went wrong"});
    });
});

//updates the Animal info you changed in the updateAnimal page
app.post('/updateAnimal/:animal', function(req, res){
    var enclosure = req.body.enclosure;
    var health = req.body.status;
    var diet = req.body.diet;
    var feeds = req.body.feedings;

    db.updateAnimalInfo(req.params.animal, enclosure, health, diet, feeds,  function(err,response){
        if(err === true){
              res.render("errorPage.ejs", {message: "Error animal not updated"});
          }
        else{
              res.redirect("/viewAnimal/"+req.params.animal);
          }
        });
  });


//allows vets to add new foods and medicine
app.get('/addNew/:type', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else if(req.session.user.dept == 9)
    {
        if(req.params.type=="Food" || req.params.type=="Medicine")
            res.render('addNew', {data:req.params.type});
        else 
            res.render('wrongRoute');
    }
   else if(req.session.user.dept ==12 && req.params.type=="Food") //nutrition manager can also add food
   {
      res.render('addNew', {data:req.params.type});
   }
    else
        res.render('errorPage', {message:"You don't have access to this page"});
});

app.post('/addNew/:type', function(req, res){
    db.addNew(req.params.type, req.body.name, req.body.stock, req.body.target, function(result){
        if(result != false)
            res.redirect('/vetTables');
        else 
            res.render('errorPage', {message: "That is already in the database"});
    });
});


app.get('/editEmployeeInfo', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else 
    {
        db.getEmployeeProfile(req.session.user.username, function(employee){
           if(employee!=false)
              res.render('editEmployeeProfile', {data:employee});
           else
              res.render('errorPage', {message:"Something went wrong"});
        });
    }
});

app.get('/updateEmployeeInfo/:id', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message:"You don't have access to this page"});
    else 
    {
            db.getEmployeeProfile(req.params.id, function(employee){
              if(employee!=false)
                  res.render('updateEmployeeInfo', {data:employee});
              else
                 res.render('errorPage', {message:"Something went wrong"});
            });
            
    }
});


app.post('/updateEmployeeInfo/:id', function(req, res){
    var firstName = req.body.first_name;
    var lastName = req.body.last_name;
    var password = req.body.password;
    var confirm_pass = req.body.password2;
    if (password == confirm_pass){
      db.updateEmployeeProfile(firstName, lastName, confirm_pass, req.params.id,  function(err,response){
          if(err === true){
              res.render("errorPage.ejs", {message: "Error Employee not updated"});
          }else{
              res.redirect("/editEmployeeInfo");
          }
        });
    }
    else{
      alert("Passwords do not match");
    }
    
});

// allow store managers to add new items
app.get('/addNewItem', function(req, res){
    if(!req.session.user)
        res.render('errorPage', {message: "You don't have access to this page"});
    else if(req.session.user.isManager && ((req.session.user.dept>=5 && req.session.user.dept<=7) || req.session.user.dept==11))
        res.render('newItem', {data: req.session.user.dept});
    else
        res.render('errorPage', {message: "You don't have access to this page"});
});

app.post('/addNewItem/:shopID', function(req, res){
    db.addNewItem(req.body.name, req.body.size, req.body.price, req.body.stock, req.body.target, req.body.image_path,req.params.shopID,function(result){
        if(result != false)
            res.redirect('/shop');
        else
            res.render('errorPage', {message: "Something went wrong. That item might already be in the shop."});
    });
});


// lets vet manager delete an animal
app.post('/delete/:animal/', function(req, res){
    db.deleteAnimal(req.params.animal, function(result)
    {
        if(result != false)
            res.redirect('/');
        else
            res.render('errorPage', {message: "Something went wrong"});
    });
});

// catch all route that will notify the user that this page doesn't exist
// this has to remain the on the bottom
app.get('*', function(req, res){
    res.render('wrongRoute');
});

app.listen(port, () => console.log(`App listening on port ${port}!`));
