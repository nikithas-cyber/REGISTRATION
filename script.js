var form = document.getElementById("registrationForm");

form.addEventListener("submit", function(event) {

    event.preventDefault();

    var name = document.getElementById("name").value;
    var registerNumber = document.getElementById("registerNumber").value;
    var email = document.getElementById("email").value;
    var password = document.getElementById("password").value;
    var age = document.getElementById("age").value;
    var dob = document.getElementById("dob").value;
    var department = document.getElementById("department").value;
    var address = document.getElementById("address").value;
    var mobile = document.getElementById("mobile").value;

    var genderElement = document.querySelector('input[name="gender"]:checked');

    var gender = "";

    if (genderElement) {
        gender = genderElement.value;
    }

    var student = {
        name: name,
        registerNumber: registerNumber,
        email: email,
        password: password,
        age: age,
        dob: dob,
        gender: gender,
        department: department,
        address: address,
        mobile: mobile
    };

    console.log(student);

    fetch("/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(student)
    })
    .then(function(response) {
        return response.text();
    })
    .then(function(data) {
        alert(data);
        form.reset();
    })
    .catch(function(error) {
        console.log(error);
        alert("Error occurred");
    });

});