import os

def getAllFiles(fpath):             #<fpath : a diretory>
    #function for put all the file in [fv]fpath into [v]filesArray and put all the folder in [fv]fpath into [v]foldersArray
    foldersArray.pop(0)
    files=os.listdir(fpath)  #get all files and folder in path
    for file in files:
        pathName=fpath+'\\'+file
        #print(pathName+" : "+str(os.path.isdir(pathName)))
        if os.path.isdir(pathName):
            foldersArray.append(pathName)
        else:
            filesArray.append(pathName)

def toLeftSlash(str):              #<str : a string>
    #change all the slash and double slash in [fv]str into left slash
    rv=str.replace('\\\\','/')
    rv=rv.replace('\\','/')
    rv=rv.replace('//','/')
    return rv






isContinue=True
while isContinue:    #determine wheather exit the programme or execute again
    path=input("Enter the path(press enter to exit)> ")  #ask the path of the target folder and store the string of pathname into [v]path
    path=path.strip(' ').strip('"')     #trim [v]path
    if not(path):  #checking for leave the programme by press enter in patth input process
        isContinue=False
        print("now exit")
        continue

    if not(os.path.isdir(path)):    #check wheather the path in [v]path exist
        print(path+" folder not exist")
        continue

    foldersArray=[path]
    filesArray=[]

    while len(foldersArray):    #put all the files in [v]path and its sub-diiretory into filesArray
        getAllFiles(foldersArray[0])


    slpath=toLeftSlash(path)    #[v]slpath is [v]path in form of all the slash change to left slash
    ohtml=open(slpath.rstrip('/')+"/index-mobile.html","w",encoding="utf-8")
    titleTemp=slpath.split('/')
    htmlTitle=titleTemp[-1]
    ohtml.write('''<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>'''+htmlTitle+'''</title>
        <style>
    *, *::after, *::before {
        box-sizing: border-box;
    }

    img {
        vertical-align: middle;
    }

    html, body {
        display: flex;
        background-color: #e8e6e6;
        height: 100%;
        width: 100%;
        padding: 0;
        margin: 0;
        font-family: sans-serif;
    }

    #list {
        height: 100%;
        overflow: auto;
        width: 100%;
        text-align: center;
    }

    #list img {
        width: 98%;
        padding: 2px;
        cursor: pointer;
    }

    #list img.current {
        background: #0003;
    }


    #dest {
        height: 100%;
        width: 100%;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }

    #page-num {
        position: fixed;
        font-size: 18pt;
        left: 10px;
        bottom: 5px;
        font-weight: bold;
        opacity: 0.75;
        text-shadow: /* Duplicate the same shadow to make it very strong */
            0 0 2px #222,
            0 0 2px #222,
            0 0 2px #222;
    }
        </style>
    </head>
    <body>

    <nav id="list">
    ''')

    for img in filesArray:  #complete the html image reader with the image tag
        extchk=img.split('.') #create temporary variable to check filename extension
        if extchk[1]!='html' and extchk[1]!='json': #files that not end with .html will be treated as image that was needed
            ohtml.write('<img src="'+toLeftSlash(img).replace(slpath+'/','')+'" class="image-item"/>\n')
            if extchk[1]!='png' and extchk[1]!='jpg':
                print('not sure file type : '+img)

    ohtml.write('''</nav>
    </body>
    </html>''')

    ohtml.close()
    del filesArray
    print('generate '+slpath+'/index-mobile.html completed')
