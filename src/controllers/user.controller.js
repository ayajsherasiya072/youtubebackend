import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadonCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'

const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"error occur while generating access and refrshtoken")
    }
}

const registerUser=asyncHandler(async (req,res)=>{

   
    const {email,fullname,username,password}=req.body

    if([fullname,email,username,password].some((field)=>field?.trim()===""))
    {
        throw new ApiError(400,"All field are required")
    }

    const existUser= await User.findOne({
        $or:[{email},{username}]
    })
    if(existUser)
    {
        throw new ApiError(409,"User already exist")
    }

    const avatarLocalPath=req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;

    const coverImageLocalPath=req.files?.coverImage?.[0]?.path;
  

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    const avatar=await uploadonCloudinary(avatarLocalPath)
    const coverImage=coverImageLocalPath ? await uploadonCloudinary(coverImageLocalPath):null;

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }

    const user=await User.create({
        email,
        fullname,
        username:username.toLowerCase(),
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        password,
    })

    const creadetUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!creadetUser)
    {
        throw new ApiError(500,"something went wrong while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200,creadetUser,"user register successfully")
    )

})

const loginUser=asyncHandler(async(req,res)=>{

    const {email,username,password}=req.body

    if(!email && !username)
    {
        throw new ApiError(400,"Email and username are required")
    }

    if(!password)
    {
        throw new ApiError(400,"Password is required")
    }

    const user=await User.findOne({
        $or:[{email},{username}]
    })

    if(!user)
    {
        throw new ApiError(404,"user does not exist")
    }

    const validPassword=user.isPasswordCorrect(password)

    if(!validPassword)
    {
        throw new ApiError(402,"incorrect password")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)

    const loggedinUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const option={
        httpOnly:true,
        secure:true
    }

    return res
        .status(200)
        .cookie("accessToken",accessToken,option)
        .cookie("refreshToken",refreshToken,option)
        .json(
            new ApiResponse(
                200,
                {
                    user:loggedinUser,accessToken,refreshToken
                },
                "user loggedin succesfully"
            )
        )



})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:""
            }
        },
        {
            new:true
        }
    )
    const option={
        httpOnly:true,
        secure:true
    }

    return  res
        .status(200)
        .clearCookie("accessToken",option)
        .clearCookie("refreshToken",option)
        .json(new ApiResponse(200,{},"user logout successfully"))

})

export {registerUser,loginUser,logoutUser}