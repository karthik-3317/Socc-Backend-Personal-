import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema({
    collegeId:{
        type:String
    },
    name:{
        type:String
    },  
    email:{
        type:String
    },
    message:{
        type:String
    },
    resolvedmessage:{
        type:String
    },
    resolved:{
        type:Boolean
    }
})

const contact = mongoose.model('contact',ContactSchema)

export default contact